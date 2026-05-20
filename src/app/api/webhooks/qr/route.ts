/**
 * QR Payment Webhook Handler
 * POST /api/webhooks/qr
 *
 * Receives payment confirmation from gateway or admin.
 *
 * Security:
 * - HMAC-SHA256 signature verification (x-webhook-signature header)
 * - Idempotency guard (skips duplicate processing)
 * - Rate limited
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { SecurityLogger, isRateLimited, rateLimitedResponse } from '@/lib/security';
import { createLogger } from '@/lib/logger';
import crypto from 'crypto';

const log = createLogger('qr-webhook');

const supabaseAdmin = getAdminSupabase();

interface WebhookPayload {
    reference_code: string;
    status: 'paid' | 'failed' | 'expired';
    amount?: number;
    timestamp?: string;
}

// =============================================================================
// Webhook Signature Verification
// =============================================================================

/**
 * Verify HMAC-SHA256 webhook signature.
 * Returns true if signature is valid, or if WEBHOOK_SECRET is not configured (dev mode).
 */
function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    const secret = process.env.WEBHOOK_SECRET;

    // In development without secret configured, allow unsigned requests with warning
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            log.error('WEBHOOK_SECRET not configured in production — rejecting request');
            return false;
        }
        log.warn('WEBHOOK_SECRET not configured — skipping signature verification (dev only)');
        return true;
    }

    if (!signatureHeader) {
        return false;
    }

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody, 'utf8')
        .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signatureHeader, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
    try {
        // Rate limiting
        const rateCheck = isRateLimited(request);
        if (rateCheck.limited) {
            log.warn('Webhook rate limited');
            return rateLimitedResponse(rateCheck.resetIn);
        }

        // Read raw body for signature verification
        const rawBody = await request.text();
        const signature = request.headers.get('x-webhook-signature');

        // Verify signature
        if (!verifyWebhookSignature(rawBody, signature)) {
            log.warn('Invalid webhook signature', {
                hasSignature: !!signature,
                ip: request.headers.get('x-forwarded-for') || 'unknown',
            });

            await SecurityLogger.log({
                event_type: 'SUSPICIOUS_ACTIVITY',
                severity: 'WARNING',
                user_id: null,
                ip_address: request.headers.get('x-forwarded-for') || 'webhook',
                details: { action: 'invalid_webhook_signature', hasSignature: !!signature },
            });

            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // Parse body after signature verification
        const body: WebhookPayload = JSON.parse(rawBody);
        const { reference_code, status, amount, timestamp } = body;

        if (!reference_code || !status) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Find payment record by reference code
        const { data: payment, error: paymentError } = await supabaseAdmin
            .from('payment')
            .select('*')
            .eq('reference_code', reference_code)
            .single();

        if (paymentError || !payment) {
            log.warn('Payment not found for webhook', { reference_code });
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        // =====================================================================
        // Idempotency Guard — skip if already in target status
        // =====================================================================
        if (payment.status === status) {
            log.info('Webhook duplicate — payment already in target status', {
                reference_code,
                status,
            });
            return NextResponse.json({
                success: true,
                message: 'Already processed (idempotent)',
            });
        }

        // Prevent backward status transitions (e.g., paid → failed)
        if (payment.status === 'paid' && status !== 'paid') {
            log.warn('Attempted backward status transition', {
                reference_code,
                currentStatus: payment.status,
                attemptedStatus: status,
            });
            return NextResponse.json({
                success: false,
                error: 'Cannot change status of a completed payment',
            }, { status: 409 });
        }

        // Verify amount if provided
        if (amount && amount !== payment.amount) {
            log.warn('Amount mismatch in webhook', {
                reference_code,
                expected: payment.amount,
                received: amount,
            });
        }

        // Update payment status
        const updateData: Record<string, unknown> = {
            status,
            updated_at: new Date().toISOString(),
        };

        if (status === 'paid') {
            updateData.paid_at = timestamp || new Date().toISOString();
        }

        await supabaseAdmin
            .from('payment')
            .update(updateData)
            .eq('id', payment.id);

        // Update corresponding order
        if (payment.order_type === 'direct_child' || payment.order_type === 'child') {
            await supabaseAdmin
                .from('order_child')
                .update({ status: status === 'paid' ? 'paid' : status })
                .eq('id', payment.order_id);

            // If this is a child order with parent, check if all children are paid
            if (payment.order_type === 'child') {
                const { data: childOrder } = await supabaseAdmin
                    .from('order_child')
                    .select('parent_id')
                    .eq('id', payment.order_id)
                    .single();

                if (childOrder?.parent_id && status === 'paid') {
                    // Check if all siblings are paid
                    const { data: allChildren } = await supabaseAdmin
                        .from('order_child')
                        .select('status')
                        .eq('parent_id', childOrder.parent_id);

                    const allPaid = allChildren?.every((c: any) => c.status === 'paid');

                    if (allPaid) {
                        await supabaseAdmin
                            .from('order_parent')
                            .update({ status: 'completed' })
                            .eq('id', childOrder.parent_id);
                    } else {
                        // At least one paid, mark as processing
                        await supabaseAdmin
                            .from('order_parent')
                            .update({ status: 'processing' })
                            .eq('id', childOrder.parent_id);
                    }
                }
            }
        } else if (payment.order_type === 'parent') {
            // Direct parent payment (total QR)
            await supabaseAdmin
                .from('order_parent')
                .update({ status: status === 'paid' ? 'completed' : status })
                .eq('id', payment.order_id);

            // Also mark all children as paid
            if (status === 'paid') {
                await supabaseAdmin
                    .from('order_child')
                    .update({ status: 'paid' })
                    .eq('parent_id', payment.order_id);
            }
        }

        // Log the webhook event
        await SecurityLogger.log({
            event_type: 'ADMIN_ACTION',
            severity: 'INFO',
            user_id: null,
            ip_address: request.headers.get('x-forwarded-for') || 'webhook',
            details: {
                action: 'payment_webhook_processed',
                reference_code,
                status,
                amount,
                order_type: payment.order_type,
            },
        });

        log.info('QR webhook processed', { reference_code, status });
        return NextResponse.json({ success: true, message: 'Webhook processed' });
    } catch (error) {
        log.error('Webhook processing failed', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET endpoint for manual status check by item_code or order_code
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'Code required' }, { status: 400 });
    }

    const upperCode = code.toUpperCase();

    // Try to find by item_code first (new direct payment flow)
    const { data: orderItem } = await supabaseAdmin
        .from('order_items')
        .select(`
            id,
            item_code,
            full_code,
            order:orders(
                id,
                order_code,
                status,
                payment_status,
                total_amount
            )
        `)
        .eq('item_code', upperCode)
        .single();

    if (orderItem && orderItem.order) {
        // Cast to any because Supabase types can be array or object for 1:1 relations
        const order = orderItem.order as any;
        return NextResponse.json({
            success: true,
            status: order.payment_status || order.status,
            amount: order.total_amount,
            order_code: order.order_code,
            item_code: orderItem.item_code,
        });
    }

    // Fallback: try by order_code
    const { data: order } = await supabaseAdmin
        .from('orders')
        .select('id, order_code, status, payment_status, total_amount')
        .eq('order_code', upperCode)
        .single();

    if (order) {
        return NextResponse.json({
            success: true,
            status: order.payment_status || order.status,
            amount: order.total_amount,
            order_code: order.order_code,
        });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

