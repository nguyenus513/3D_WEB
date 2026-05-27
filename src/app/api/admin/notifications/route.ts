import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';

function repairNotificationText(value: unknown, fallback = '') {
    if (typeof value !== 'string' || value.length === 0) return fallback;
    if (!/[\u00c3\u00c4\u00c2]/.test(value)) return value;
    try {
        return Buffer.from(value, 'latin1').toString('utf8');
    } catch {
        return value;
    }
}

function orderAmount(order: any, notification: any) {
    return Number(notification.total_amount ?? order?.total_amount ?? order?.total ?? order?.subtotal ?? 0) || 0;
}

function adminActionUrl(notification: any, orderId: string | null) {
    if (notification.action_url) return notification.action_url;
    return orderId ? `/sys_internal/orders/${orderId}` : '/sys_internal/orders';
}

function notificationCreatedAt(notification: any, order: any) {
    const candidates = [
        notification.created_at,
        notification.updated_at,
        order?.created_at,
        order?.updated_at,
    ];
    const valid = candidates.find((value) => value && !Number.isNaN(new Date(value).getTime()));
    return valid || new Date().toISOString();
}

export async function GET() {
    try {
        const session = await auth();
        const userRole = (session?.user as { role?: string })?.role;
        if (!session?.user || userRole !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = getAdminSupabase();
        const profileId = await getProfileId(session.user, supabase);
        if (!profileId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 401 });
        }

        const { data: notifications, error: notifError } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', profileId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (notifError) {
            console.error('[AdminNotifications] Fetch error:', notifError);
        }

        const { count } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profileId)
            .eq('is_read', false);

        const orderIds = [...new Set((notifications || [])
            .map((notification: any) => notification.ref_order_id || (notification.ref_type === 'order' ? notification.ref_id : null))
            .filter(Boolean))];

        let ordersById = new Map<string, any>();
        if (orderIds.length > 0) {
            const { data: relatedOrders } = await supabase
                .from('orders')
                .select('id, order_code, order_type, status, payment_status, total_amount, total, subtotal, created_at, shipping_address_snapshot')
                .in('id', orderIds);

            ordersById = new Map((relatedOrders || []).map((order: any) => [order.id, order]));
        }

        const notificationItems = (notifications || []).map((notification: any) => {
            const orderId = notification.ref_order_id || (notification.ref_type === 'order' ? notification.ref_id : null);
            const order = orderId ? ordersById.get(orderId) : null;
            return {
                id: orderId || notification.id,
                notification_id: notification.id,
                order_code: notification.order_code || order?.order_code || repairNotificationText(notification.title, 'Thông báo'),
                order_type: notification.order_type || order?.order_type || notification.ref_type || notification.type,
                status: notification.order_status || order?.status || notification.type,
                payment_status: notification.payment_status || order?.payment_status || null,
                total: orderAmount(order, notification),
                customer_name: notification.customer_name || order?.shipping_address_snapshot?.full_name || order?.shipping_address_snapshot?.name || null,
                severity: notification.severity || 'info',
                action_url: adminActionUrl(notification, orderId),
                type: notification.type,
                created_at: notificationCreatedAt(notification, order),
                title: repairNotificationText(notification.title),
                message: repairNotificationText(notification.message),
                is_read: Boolean(notification.is_read),
            };
        });

        return NextResponse.json({
            notifications: notificationItems,
            orders: notificationItems,
            unread_count: count || 0,
        });
    } catch (error) {
        console.error('[AdminNotifications] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
