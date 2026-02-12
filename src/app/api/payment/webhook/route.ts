/**
 * Stripe Webhook Handler
 * 
 * POST /api/payment/webhook - Handle Stripe webhook events
 * 
 * @see stripe-integration skill - Webhook signature verification is critical
 */

import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/services/PaymentService';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const paymentService = new PaymentService();
const log = createLogger('payment-webhook');

// App Router: body is NOT auto-parsed. Use request.text() for raw body access.

export async function POST(request: NextRequest) {
    try {
        // Get raw body for signature verification
        const rawBody = await request.text();
        const signature = request.headers.get('stripe-signature');

        if (!signature) {
            return NextResponse.json(
                { error: 'Missing stripe-signature header' },
                { status: 400 }
            );
        }

        // Verify webhook signature
        const event = await paymentService.verifyWebhookSignature(rawBody, signature);

        // Handle different event types
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object;
                await handlePaymentSuccess(
                    paymentIntent.id,
                    paymentIntent.metadata.orderId,
                    paymentIntent.amount
                );
                break;
            }

            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object;
                await handlePaymentFailed(
                    paymentIntent.id,
                    paymentIntent.metadata.orderId,
                    paymentIntent.last_payment_error?.message || 'Unknown error'
                );
                break;
            }

            default:
                log.warn('Unhandled event type', { eventType: event.type });
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        log.error('Webhook processing failed', error);
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 400 }
        );
    }
}

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(
    paymentIntentId: string,
    orderId: string | undefined,
    amount: number
) {
    if (!orderId) {
        log.error('No orderId in payment intent metadata');
        return;
    }

    const supabase = getAdminSupabase();

    // Update payment record
    await supabase
        .from('payments')
        .update({
            status: 'completed',
            transaction_id: paymentIntentId,
            paid_at: new Date().toISOString(),
        })
        .eq('order_id', orderId);

    // Update order status
    await supabase
        .from('orders')
        .update({
            status: 'confirmed',
            deposit_paid: true,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

    log.info('Payment successful', { orderId, amount });
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(
    paymentIntentId: string,
    orderId: string | undefined,
    errorMessage: string
) {
    if (!orderId) {
        log.error('No orderId in failed payment metadata');
        return;
    }

    const supabase = getAdminSupabase();

    // Update payment record with failure
    await supabase
        .from('payments')
        .update({
            status: 'failed',
            transaction_id: paymentIntentId,
        })
        .eq('order_id', orderId);

    log.warn('Payment failed', { orderId, errorMessage });
}
