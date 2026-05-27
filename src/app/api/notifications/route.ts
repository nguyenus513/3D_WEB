/**
 * User Notifications API
 * GET /api/notifications - List notifications for authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';

function buildActionUrl(notification: any) {
    if (notification.action_url) return notification.action_url;
    const orderId = notification.ref_order_id || (notification.ref_type === 'order' ? notification.ref_id : null);
    if (orderId) return `/account/orders/${orderId}`;
    if (notification.ref_type === 'design_version' && notification.ref_id) return `/account/orders/${notification.ref_id}/demo`;
    return '/account/orders';
}

function normalizeNotification(notification: any) {
    const orderId = notification.ref_order_id || (notification.ref_type === 'order' ? notification.ref_id : null);
    return {
        ...notification,
        ref_order_id: orderId,
        severity: notification.severity || (notification.type === 'payment_paid' ? 'success' : 'info'),
        action_url: buildActionUrl(notification),
        total_amount: Number(notification.total_amount || 0) || null,
    };
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = getAdminSupabase();
        const profileId = await getProfileId(session.user, supabase);
        if (!profileId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // optional filter
        const unreadOnly = searchParams.get('unread') === 'true';
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', profileId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (type) {
            query = query.eq('type', type);
        }

        if (unreadOnly) {
            query = query.eq('is_read', false);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[Notifications] Fetch error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Also get unread count
        const { count } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profileId)
            .eq('is_read', false);

        return NextResponse.json({
            success: true,
            notifications: (data || []).map(normalizeNotification),
            unread_count: count || 0,
        });
    } catch (error) {
        console.error('[Notifications] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
