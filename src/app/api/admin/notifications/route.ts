/**
 * Admin Notifications API
 * GET /api/admin/notifications
 *
 * Fetches notifications from the notifications table for admin users.
 * Supports both the new notification system and legacy order-based notifications.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';

export async function GET() {
    try {
        // Verify admin auth
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

        // Fetch notifications for this admin
        const { data: notifications, error: notifError } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', profileId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (notifError) {
            console.error('[AdminNotifications] Fetch error:', notifError);
        }

        // Get unread count
        const { count } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profileId)
            .eq('is_read', false);

        // Also fetch pending orders (legacy compatibility — actionable items)
        const { data: pendingOrders } = await supabase
            .from('orders')
            .select(`
                id,
                order_code,
                order_type,
                status,
                total: total_amount,
                created_at,
                users:user_id (
                    name,
                    email
                )
            `)
            .in('status', ['pending', 'pending_confirmation', 'paid'])
            .order('created_at', { ascending: false })
            .limit(5);

        return NextResponse.json({
            notifications: notifications || [],
            orders: pendingOrders || [],
            unread_count: count || 0,
        });
    } catch (error) {
        console.error('[AdminNotifications] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
