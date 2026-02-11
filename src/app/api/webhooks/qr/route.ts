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

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

interface WebhookPayload {
    reference_code: string;      // code_child or code_parent
    status: 'paid' | 'failed' | 'expired';
    amount?: number;
    timestamp?: string;
    signature?: string;          // For HMAC verification if needed
}

export async function POST(request: NextRequest) {
    try {
        const body: WebhookPayload = await request.json();
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
            console.error('[Webhook] Payment not found:', reference_code);
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        // Verify amount if provided
        if (amount && amount !== payment.amount) {
            console.warn('[Webhook] Amount mismatch:', { expected: payment.amount, received: amount });
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

                    const allPaid = allChildren?.every(c => c.status === 'paid');

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
                action: 'payment_webhook_received',
                reference_code,
                status,
                amount,
                order_type: payment.order_type,
            },
        });

        return NextResponse.json({ success: true, message: 'Webhook processed' });
    } catch (error) {
        console.error('[Webhook] Error:', error);
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

