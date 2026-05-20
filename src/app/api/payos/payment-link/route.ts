import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';
import { createPayOSOrderCode, getPayOS, getPayOSConfigStatus, getPayOSDescription, getPayOSReturnUrl, isPayOSConfigured } from '@/lib/payos';

type GatewayResponse = Record<string, unknown> | null;

function getErrorDetail(error: unknown) {
  if (!error || typeof error !== 'object') return null;
  const value = error as Record<string, unknown>;
  return {
    name: typeof value.name === 'string' ? value.name : undefined,
    code: typeof value.code === 'string' ? value.code : undefined,
    desc: typeof value.desc === 'string' ? value.desc : undefined,
    status: typeof value.status === 'number' ? value.status : undefined,
  };
}

function asGateway(value: unknown): GatewayResponse {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function POST(request: NextRequest) {
  let stage = 'init';
  try {
    if (!isPayOSConfigured()) {
      return NextResponse.json({ success: false, error: 'PAYOS_NOT_CONFIGURED', stage: 'config' }, { status: 503 });
    }

    stage = 'auth';
    const session = await auth();

    stage = 'parse_request';
    const { orderId } = await request.json();
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ success: false, error: 'ORDER_ID_REQUIRED' }, { status: 400 });
    }

    stage = 'db_connect';
    const supabase = getAdminSupabase();
    const profileId = session?.user ? await getProfileId(session.user, supabase) : null;

    stage = 'order_lookup';
    let orderQuery = supabase
      .from('orders')
      .select('id, order_code, user_id, total_amount, total, deposit_amount, payment_status, order_type')
      .eq('id', orderId);

    if (profileId) {
      orderQuery = orderQuery.eq('user_id', profileId);
    }

    const { data: order, error: orderError } = await orderQuery.maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'ORDER_NOT_FOUND', stage, detail: orderError?.message }, { status: 404 });
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ success: true, paid: true });
    }

    const amount = Number(order.deposit_amount || order.total_amount || order.total || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'INVALID_AMOUNT', stage: 'amount', amount }, { status: 400 });
    }

    stage = 'existing_payment_lookup';
    const { data: existingPayments } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', order.id)
      .eq('method', 'payos')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    const existing = existingPayments?.[0];
    const existingGateway = asGateway(existing?.gateway_response);
    if (existingGateway?.checkout_url && existingGateway?.payment_link_id) {
      return NextResponse.json({
        success: true,
        data: {
          orderId: order.id,
          orderCode: order.order_code,
          amount,
          checkoutUrl: existingGateway.checkout_url,
          qrCode: existingGateway.qr_code,
          paymentLinkId: existingGateway.payment_link_id,
          payosOrderCode: existingGateway.payos_order_code,
        },
      });
    }

    stage = 'payos_client';
    const payos = getPayOS();
    const payosOrderCode = createPayOSOrderCode();
    const returnUrl = getPayOSReturnUrl(order.id);
    stage = 'payos_create_link';
    const paymentLink = await payos.paymentRequests.create({
      orderCode: payosOrderCode,
      amount: Math.round(amount),
      description: getPayOSDescription(order.order_code),
      returnUrl,
      cancelUrl: returnUrl,
      items: [{
        name: `Don hang ${order.order_code}`,
        quantity: 1,
        price: Math.round(amount),
      }],
    });

    const gatewayResponse = {
      provider: 'payos',
      payos_order_code: payosOrderCode,
      payment_link_id: paymentLink.paymentLinkId,
      checkout_url: paymentLink.checkoutUrl,
      qr_code: paymentLink.qrCode,
      description: paymentLink.description,
      account_number: paymentLink.accountNumber,
      account_name: paymentLink.accountName,
      bin: paymentLink.bin,
      status: paymentLink.status,
    };

    stage = 'payment_insert';
    const { error: insertError } = await supabase.from('payments').insert({
      order_id: order.id,
      transaction_code: String(payosOrderCode),
      amount: Math.round(amount),
      method: 'payos',
      status: 'pending',
      gateway_response: gatewayResponse,
    });

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message, stage }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderCode: order.order_code,
        amount,
        checkoutUrl: paymentLink.checkoutUrl,
        qrCode: paymentLink.qrCode,
        paymentLinkId: paymentLink.paymentLinkId,
        payosOrderCode,
      },
    });
  } catch (error) {
    console.error('[PayOSPaymentLink] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'INTERNAL_ERROR',
      stage,
      detail: getErrorDetail(error),
      config: getPayOSConfigStatus(),
    }, { status: 500 });
  }
}
