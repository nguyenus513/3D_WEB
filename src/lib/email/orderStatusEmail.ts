import { getAdminSupabase } from '@/lib/supabase/admin';
import { buildOrderStatusEmailOptions } from '@/lib/email/sendEmail';
import { enqueueEmailJob } from '@/lib/email/emailQueue';

function normalizeOrderType(value?: string | null) {
  if (value === 'print_3d') return 'printing';
  if (value === 'product') return 'ready_made';
  return value || 'ready_made';
}

function amount(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveDemoImage(order: any): string | undefined {
  if (order?.demo_image_url) return order.demo_image_url;
  const images = Array.isArray(order?.demo_images) ? order.demo_images : [];
  const latest = images[images.length - 1];
  return latest?.url || latest?.image_url || undefined;
}

function resolveShippingAddress(order: any) {
  return order?.shipping_address || order?.shipping_address_snapshot || null;
}

export async function sendOrderStatusEmail(params: {
  orderId: string;
  oldStatus?: string | null;
  newStatus?: string | null;
  shippingCode?: string | null;
}) {
  const { orderId, oldStatus, newStatus } = params;
  if (!orderId || !newStatus) {
    console.log('[OrderStatusEmail] skipped', { orderId, oldStatus, newStatus });
    return false;
  }

  const supabase = getAdminSupabase();
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, user_id, order_code, order_type, status, total_amount, total, subtotal, deposit_amount, shipping_code, shipping_address, shipping_address_snapshot, demo_image_url, demo_images, customer_email')
    .eq('id', orderId)
    .maybeSingle() as any;

  if (error || !order) {
    console.warn('[OrderStatusEmail] order not found', { orderId, error: error?.message });
    return false;
  }

  let profile: any = null;
  if (order.user_id) {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, name, full_name, phone, customer_code')
      .eq('id', order.user_id)
      .maybeSingle() as any;
    if (profileError) console.warn('[OrderStatusEmail] profile lookup failed', { orderId, userId: order.user_id, error: profileError.message });
    profile = profileData || null;
  }

  const shippingAddress = resolveShippingAddress(order);
  const customerEmail = profile?.email || order.customer_email || shippingAddress?.email || null;
  if (!customerEmail) {
    console.warn('[OrderStatusEmail] missing customer email', { orderId, orderCode: order.order_code, userId: order.user_id });
    return false;
  }

  console.log('[OrderStatusEmail] resolved recipient', {
    orderId,
    orderCode: order.order_code,
    status: newStatus,
    customerEmail,
  });

  const emailData = {
    orderId,
    status: newStatus,
    customerName: profile?.full_name || profile?.name || shippingAddress?.full_name || 'khách hàng',
    customerEmail,
    orderCode: order.order_code || orderId.slice(0, 8).toUpperCase(),
    orderType: normalizeOrderType(order.order_type),
    total: amount(order.total_amount) || amount(order.total) || amount(order.subtotal),
    depositAmount: amount(order.deposit_amount),
    shippingCode: params.shippingCode || order.shipping_code || undefined,
    carrier: (params.shippingCode || order.shipping_code) ? 'Viettel Post' : undefined,
    shippingAddress,
    demoImageUrl: resolveDemoImage(order),
    reviewLink: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.miniver.id.vn'}/account/orders/${orderId}/demo`,
  };

  const options = buildOrderStatusEmailOptions(emailData);
  if (!options) {
    console.warn('[OrderStatusEmail] unsupported status/email data', { orderId, oldStatus, newStatus, customerEmail });
    return false;
  }

  const result = await enqueueEmailJob({
    ...options,
    orderId,
    orderCode: emailData.orderCode,
    status: newStatus,
    recipientName: emailData.customerName,
    source: 'order_status',
  });

  console.log(result.sent ? '[OrderStatusEmail] sent' : '[OrderStatusEmail] queued', { orderId, oldStatus, newStatus, customerEmail, key: result.key });
  return result.queued;
}

