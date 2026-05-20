import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/admin-guard';

/**
 * GET /api/admin/stats
 * Fetch dashboard stats from unified orders table
 */
export async function GET(request: NextRequest) {
    try {
        // SECURITY: Verify admin access
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const supabase = getAdminSupabase();

        // Fetch all data in parallel from unified schema
        const [ordersRes, customersRes, productsRes] = await Promise.all([
            supabase.from('orders').select('*, user:users(id, name, email, phone, customer_code, profile:user_profiles(full_name, phone)), items:order_items(*)').order('created_at', { ascending: false }),
            supabase.from('users').select('*'),
            supabase.from('products').select('id'),
        ]);

        const orders = ordersRes.data || [];
        const allProfiles = customersRes.data || [];
        const products = productsRes.data || [];

        // Filter out admins
        const customers = allProfiles.filter((p: { role?: string }) => p.role !== 'admin');
        const profileMap = new Map((allProfiles as any[]).map((profile) => [profile.id, profile]));

        // Get current month
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        const isCurrentMonth = (dateStr: string) => {
            const date = new Date(dateStr);
            return date.getMonth() + 1 === currentMonth && date.getFullYear() === currentYear;
        };

        // Helper to get revenue from an order
        const getRevenue = (o: any) => {
            if (['paid', 'completed', 'delivered'].includes(o.payment_status) ||
                ['completed', 'delivered', 'confirmed', 'processing', 'producing', 'shipping'].includes(o.status)) {
                return Number(o.total_amount || 0);
            }
            return 0;
        };

        // Calculate Revenue
        const monthlyRevenue = orders
            .filter((o: any) => isCurrentMonth(o.created_at))
            .reduce((sum: number, o: any) => sum + getRevenue(o), 0);

        // Count pending orders
        const pendingOrders = orders.filter((o: any) => o.status === 'pending').length;

        const getCustomerName = (order: any) => {
            const shipping = order.shipping_address || order.shipping_address_snapshot || {};
            const profile = order.user || profileMap.get(order.user_id) || {};
            return profile?.profile?.full_name
                || profile?.full_name
                || profile?.name
                || shipping?.full_name
                || profile?.email?.split('@')[0]
                || 'Chưa có tên khách hàng';
        };

        // Transform for Recent Orders
        const recentOrders = orders.slice(0, 5).map((o: any) => ({
            id: o.id,
            order_code: o.order_code || o.cart_code,
            order_type: o.order_type || 'ready_made',
            total: Number(o.total_amount || 0),
            status: o.status,
            customer_name: getCustomerName(o),
            created_at: o.created_at,
        }));

        return NextResponse.json({
            stats: {
                revenue: monthlyRevenue,
                currentMonth,
                orders: orders.length,
                customers: customers.length,
                products: products.length,
                pendingOrders,
            },
            recentOrders,
        });
    } catch (error) {
        console.error('Admin stats API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}


