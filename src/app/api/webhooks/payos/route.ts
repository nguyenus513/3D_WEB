import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getPayOS, isPayOSConfigured } from '@/lib/payos';
import { persistPaidCustomModelImages } from '@/lib/custom/model-image';
import { sendOrderStatusEmail } from '@/lib/email/orderStatusEmail';
import { adjustReadyMadeOrderStock } from '@/lib/stock/order-stock';

export async function POST(request: NextRequest) {
  try {
    if (!isPayOSConfigured()) {
      return NextResponse.json({ success: false, error: 'PAYOS_NOT_CONFIGURED' }, { status: 503 });
    }

    const body = await request.json();
    const webhookData = await getPayOS().webhooks.verify(body);

    if (!webhookData || webhookData.code !== '00') {
      return NextResponse.json({ success: true, ignored: true });
    }

    const supabase = getAdminSupabase();
    const payosOrderCode = String(webhookData.orderCode);

    const { data: payments } = await supabase
      .from('payments')
      .select('id, order_id, amount, status, gateway_response')
      .eq('transaction_code', payosOrderCode)
      .eq('method', 'payos')
      .limit(1);

    const payment = payments?.[0];
    if (!payment) {
      console.warn('[PayOSWebhook] Payment not found', { payosOrderCode });
      return NextResponse.json({ success: true, missing: true });
    }

    if (payment.status === 'paid') {
      return NextResponse.json({ success: true, duplicate: true });
    }

    const paidAt = new Date().toISOString();
    const { data: beforeOrder } = await supabase
      .from('orders')
      .select('status')
      .eq('id', payment.order_id)
      .maybeSingle();
    const gatewayResponse = {
      ...(payment.gateway_response || {}),
      webhook: webhookData,
      payos_status: 'PAID',
      paid_reference: webhookData.reference,
      paid_at: paidAt,
    };

    await supabase
      .from('payments')
      .update({
        status: 'paid',
        confirmed_at: paidAt,
        gateway_response: gatewayResponse,
      })
      .eq('id', payment.id);

    await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        status: 'confirmed',
        paid_at: paidAt,
        confirmed_at: paidAt,
        updated_at: paidAt,
      })
      .eq('id', payment.order_id);

    await adjustReadyMadeOrderStock(payment.order_id, 'confirm').catch((error) => {
      console.error('[PayOSWebhook] Stock confirm failed:', error);
    });

    await persistPaidCustomModelImages(payment.order_id).catch((error) => {
      console.error('[PayOSWebhook] Persist model images failed:', error);
    });

    await sendOrderStatusEmail({
      orderId: payment.order_id,
      oldStatus: beforeOrder?.status,
      newStatus: 'confirmed',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PayOSWebhook] Error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'WEBHOOK_ERROR' }, { status: 400 });
  }
}
