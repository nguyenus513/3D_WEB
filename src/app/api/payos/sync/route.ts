import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPayOS, isPayOSConfigured } from '@/lib/payos';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';
import { persistPaidCustomModelImages } from '@/lib/custom/model-image';
import { sendOrderStatusEmail } from '@/lib/email/orderStatusEmail';
import { adjustReadyMadeOrderStock } from '@/lib/stock/order-stock';

type GatewayResponse = Record<string, unknown> | null;

function asGateway(value: unknown): GatewayResponse {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getPayOSLookupId(payment: Record<string, unknown>, gateway: GatewayResponse) {
  const paymentLinkId = gateway?.payment_link_id;
  if (typeof paymentLinkId === 'string' && paymentLinkId) return paymentLinkId;
  const transactionCode = payment.transaction_code;
  if (typeof transactionCode === 'string' && transactionCode) return Number(transactionCode);
  if (typeof transactionCode === 'number') return transactionCode;
  return null;
}

export async function POST(request: NextRequest) {
  let stage = 'init';
  try {
    if (!isPayOSConfigured()) {
      return NextResponse.json({ success: false, error: 'PAYOS_NOT_CONFIGURED', stage: 'config' }, { status: 503 });
    }

    stage = 'parse_request';
    const { orderId } = await request.json();
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ success: false, error: 'ORDER_ID_REQUIRED', stage }, { status: 400 });
    }

    stage = 'auth';
    const session = await auth();
    const supabase = getAdminSupabase();
    const profileId = session?.user ? await getProfileId(session.user, supabase) : null;

    stage = 'order_lookup';
    let orderQuery = supabase
      .from('orders')
      .select('id, user_id, payment_status, status')
      .eq('id', orderId);

    if (profileId) orderQuery = orderQuery.eq('user_id', profileId);

    const { data: order, error: orderError } = await orderQuery.maybeSingle();
    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'ORDER_NOT_FOUND', stage, detail: orderError?.message }, { status: 404 });
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ success: true, paid: true, status: 'PAID' });
    }

    stage = 'payment_lookup';
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', order.id)
      .eq('method', 'payos')
      .order('created_at', { ascending: false })
      .limit(1);

    const payment = payments?.[0] as Record<string, unknown> | undefined;
    if (!payment) {
      return NextResponse.json({ success: true, paid: false, status: 'NO_PAYOS_PAYMENT' });
    }

    const gateway = asGateway(payment.gateway_response);
    const lookupId = getPayOSLookupId(payment, gateway);
    if (!lookupId) {
      return NextResponse.json({ success: false, error: 'PAYOS_LOOKUP_ID_MISSING', stage }, { status: 400 });
    }

    stage = 'payos_get_payment';
    const payosPayment = await getPayOS().paymentRequests.get(lookupId as string & number);
    const status = String(payosPayment.status || '').toUpperCase();

    if (status !== 'PAID') {
      return NextResponse.json({ success: true, paid: false, status, data: { paymentLinkId: payosPayment.id, orderCode: payosPayment.orderCode } });
    }

    stage = 'db_update';
    const paidAt = new Date().toISOString();
    const gatewayResponse = {
      ...(gateway || {}),
      payos_sync: payosPayment,
      payos_status: 'PAID',
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
      .eq('id', order.id);

    await adjustReadyMadeOrderStock(order.id, 'confirm').catch((error) => {
      console.error('[PayOSSync] Stock confirm failed:', error);
    });

    await persistPaidCustomModelImages(order.id).catch((error) => {
      console.error('[PayOSSync] Persist model images failed:', error);
    });

    await sendOrderStatusEmail({
      orderId: order.id,
      oldStatus: order.status,
      newStatus: 'confirmed',
    });

    return NextResponse.json({ success: true, paid: true, status: 'PAID' });
  } catch (error) {
    console.error('[PayOSSync] Error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'PAYOS_SYNC_ERROR', stage }, { status: 500 });
  }
}
