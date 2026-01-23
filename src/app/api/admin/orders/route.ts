import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/admin-guard';

/**
 * GET /api/admin/orders
 * Fetch orders with profile data using admin privileges (bypasses RLS)
 * 
 * SECURITY: Pagination enforced with max limit to prevent DoS
 */
export async function GET(request: Request) {
    try {
        // SECURITY: Verify admin access
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const supabase = getAdminSupabase();
        const { searchParams } = new URL(request.url);
        const orderType = searchParams.get('type') || 'all';

        // SECURITY: Pagination with enforced max limit
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50'))); // Max 100

        // 1. Fetch orders with pagination
        let query = supabase
            .from('orders')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

        if (orderType !== 'all') {
            query = query.eq('order_type', orderType);
        }

        const { data: orders, count, error } = await query;

        if (error) {
            console.error('Error fetching orders:', error);
            return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
        }

        if (!orders || orders.length === 0) {
            return NextResponse.json({ orders: [], total: 0, page, limit });
        }

        // 2. Get unique user_ids
        const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))] as string[];

        // 3. Fetch profiles for those user_ids (admin bypasses RLS)
        let profileMap: Record<string, { full_name?: string; email?: string; phone?: string; instagram_username?: string }> = {};
        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, email, phone, instagram_username')
                .in('id', userIds);

            if (profiles) {
                profileMap = Object.fromEntries(
                    profiles.map((p: { id: string; full_name?: string; email?: string; phone?: string; instagram_username?: string }) => [p.id, p])
                );
            }
        }

        // 4. Merge orders with profiles
        const ordersWithProfiles = orders.map(order => ({
            ...order,
            profiles: order.user_id && profileMap[order.user_id] ? profileMap[order.user_id] : null
        }));

        return NextResponse.json({
            orders: ordersWithProfiles,
            total: count || 0,
            page,
            limit
        });
    } catch (error) {
        console.error('Admin orders API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
