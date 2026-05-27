/**
 * Notification Helper Library
 * Creates notifications for SaaS-grade event tracking.
 *
 * Usage:
 *   await createNotification({
 *     userId: 'uuid',
 *     title: 'Khách đã duyệt thiết kế',
 *     type: 'design_approved',
 *     refId: orderId,
 *     refType: 'order',
 *   });
 */

import { getAdminSupabase } from '@/lib/supabase/admin';

export type NotificationType =
    | 'order_created'
    | 'design_approved'
    | 'design_rejected'
    | 'design_uploaded'
    | 'order_status'
    | 'payment'
    | 'payment_paid'
    | 'file_issue'
    | 'mail_error';

export type RefType = 'order' | 'design_version' | 'payment' | 'file';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'urgent';

interface CreateNotificationParams {
    userId: string;
    title: string;
    message?: string;
    type: NotificationType;
    severity?: NotificationSeverity;
    refId?: string;
    refType?: RefType;
    refOrderId?: string;
    actionUrl?: string;
    orderCode?: string;
    orderType?: string;
    customerName?: string;
    totalAmount?: number;
    paymentStatus?: string;
    orderStatus?: string;
    metadata?: Record<string, unknown>;
}

function getDefaultSeverity(type: NotificationType): NotificationSeverity {
    if (type === 'payment_paid' || type === 'design_approved') return 'success';
    if (type === 'design_rejected' || type === 'file_issue' || type === 'mail_error') return 'warning';
    if (type === 'payment' || type === 'order_created') return 'urgent';
    return 'info';
}

async function enrichOrder(params: CreateNotificationParams) {
    const supabase = getAdminSupabase();
    const orderId = params.refOrderId || (params.refType === 'order' ? params.refId : undefined);
    if (!orderId) return params;

    const { data: order } = await supabase
        .from('orders')
        .select('id, order_code, order_type, status, payment_status, total_amount, total, subtotal, user_id, shipping_address_snapshot')
        .eq('id', orderId)
        .maybeSingle();

    if (!order) return params;

    return {
        ...params,
        refOrderId: order.id,
        orderCode: params.orderCode || order.order_code,
        orderType: params.orderType || order.order_type,
        totalAmount: params.totalAmount ?? Number(order.total_amount ?? order.total ?? order.subtotal ?? 0),
        paymentStatus: params.paymentStatus || order.payment_status,
        orderStatus: params.orderStatus || order.status,
        customerName: params.customerName || order.shipping_address_snapshot?.full_name || order.shipping_address_snapshot?.name,
        actionUrl: params.actionUrl || `/sys_internal/orders/${order.id}`,
    };
}

function buildPayload(params: CreateNotificationParams) {
    const refOrderId = params.refOrderId || (params.refType === 'order' ? params.refId : null);
    return {
        user_id: params.userId,
        title: params.title,
        message: params.message || null,
        type: params.type,
        severity: params.severity || getDefaultSeverity(params.type),
        ref_id: params.refId || null,
        ref_type: params.refType || null,
        ref_order_id: refOrderId || null,
        action_url: params.actionUrl || (refOrderId ? `/account/orders/${refOrderId}` : null),
        order_code: params.orderCode || null,
        order_type: params.orderType || null,
        customer_name: params.customerName || null,
        total_amount: params.totalAmount ?? null,
        payment_status: params.paymentStatus || null,
        order_status: params.orderStatus || null,
        metadata: params.metadata || null,
        is_read: false,
        created_at: new Date().toISOString(),
    };
}

/**
 * Create a single notification for a user.
 * Uses admin client to bypass RLS.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
    const supabase = getAdminSupabase();
    const enriched = await enrichOrder(params);

    const { error } = await supabase
        .from('notifications')
        .insert(buildPayload(enriched));

    if (error) {
        console.error('[Notification] Failed to create:', error.message, params);
    }
}

/**
 * Notify all admin users about an event.
 * Queries users with role='admin' and creates a notification for each.
 */
export async function notifyAllAdmins(params: Omit<CreateNotificationParams, 'userId'>): Promise<void> {
    const supabase = getAdminSupabase();
    const enriched = await enrichOrder(params as CreateNotificationParams);

    // Fetch all admin user IDs
    const { data: admins, error } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');

    if (error || !admins?.length) {
        console.error('[Notification] Failed to fetch admins:', error?.message);
        return;
    }

    // Create notification for each admin
    const notifications = admins.map((admin: any) => buildPayload({ ...enriched, userId: admin.id }));

    const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

    if (insertError) {
        console.error('[Notification] Failed to notify admins:', insertError.message);
    }
}
