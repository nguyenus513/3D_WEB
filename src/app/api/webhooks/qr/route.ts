/**
 * QR Payment Webhook Handler
 * POST /api/webhooks/qr
 *
 * Receives payment confirmation from gateway or admin
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';
import { SecurityLogger } from '@/lib/security';
import { createHmac, timingSafeEqual } from 'crypto';

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

interface WebhookPayload {
    reference_code: string;
    status: 'paid' | 'failed' | 'expired';
    amount?: number;
    timestamp?: string;
    signature?: string;
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
    const normalized = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(normalized, 'utf8');
    if (expectedBuf.length !== providedBuf.length) return false;

    return timingSafeEqual(expectedBuf, providedBuf);
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const body: WebhookPayload = JSON.parse(rawBody);

        const secret = process.env.QR_WEBHOOK_SECRET;
        if (secret) {
            const signature = request.headers.get('x-webhook-signature') || body.signature || '';
            if (!signature || !verifySignature(rawBody, signature, secret)) {
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
            }
        } else if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
        }

        const { reference_code, status, amount, timestamp } = body;

        if (!reference_code || !status) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        let { data: payment } = await supabaseAdmin
            .from('payments')
            .select('*')
            .eq('transaction_code', reference_code)
            .maybeSingle();

        if (!payment) {
            const { data: altPayment } = await supabaseAdmin
                .from('payments')
                .select('*')
                .eq('gateway_response->>reference_code', reference_code)
                .maybeSingle();

            if (altPayment) payment = altPayment;
        }

        if (!payment) {
            console.error('[Webhook] Payment not found:', reference_code);
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        if (amount && amount !== payment.amount) {
            console.warn('[Webhook] Amount mismatch:', { expected: payment.amount, received: amount });
        }

        const updateData: Record<string, unknown> = {
            status,
            updated_at: new Date().toISOString(),
        };

        if (status === 'paid') {
            const currentGatewayResponse = payment.gateway_response || {};
            updateData.gateway_response = {
                ...currentGatewayResponse,
                paid_at: timestamp || new Date().toISOString(),
                webhook_payload: body
            };
        }

        await supabaseAdmin
            .from('payments')
            .update(updateData)
            .eq('id', payment.id);

        if (payment.order_id) {
            const { data: order } = await supabaseAdmin
                .from('orders')
                .select('id, order_type, status')
                .eq('id', payment.order_id)
                .maybeSingle();

            const orderUpdate: any = {
                updated_at: new Date().toISOString()
            };

            if (status === 'paid') {
                orderUpdate.payment_status = 'paid';
                orderUpdate.paid_at = timestamp || new Date().toISOString();

                if (order && ['pending', 'pending_confirmation'].includes(order.status)) {
                    if (order.order_type === 'printing') {
                        orderUpdate.status = 'printing';
                    } else if (order.order_type === 'custom') {
                        orderUpdate.status = 'confirmed';
                        orderUpdate.confirmed_at = new Date().toISOString();
                    } else {
                        orderUpdate.status = 'processing';
                    }
                }
            } else if (status === 'failed') {
                orderUpdate.payment_status = 'failed';
            }

            await supabaseAdmin
                .from('orders')
                .update(orderUpdate)
                .eq('id', payment.order_id);
        }

        await SecurityLogger.log({
            event_type: 'ADMIN_ACTION',
            severity: 'INFO',
            user_id: null,
            ip_address: request.headers.get('x-forwarded-for') || 'webhook',
            details: {
                action: 'payment_webhook_received',
                reference_code,
                status,
                amount,
                payment_id: payment.id,
                order_id: payment.order_id
            },
        });

        return NextResponse.json({ success: true, message: 'Webhook processed' });
    } catch (error) {
        console.error('[Webhook] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET endpoint for manual status check
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'Code required' }, { status: 400 });
    }

    let { data: payment } = await supabaseAdmin
        .from('payments')
        .select('status, amount, gateway_response')
        .eq('transaction_code', code)
        .maybeSingle();

    if (!payment) {
        const { data: altPayment } = await supabaseAdmin
            .from('payments')
            .select('status, amount, gateway_response')
            .eq('gateway_response->>reference_code', code)
            .maybeSingle();
        if (altPayment) payment = altPayment;
    }

    if (!payment) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const meta = payment.gateway_response || {};
    return NextResponse.json({
        status: payment.status,
        amount: payment.amount,
        paidAt: meta.paid_at || null,
    });
}
