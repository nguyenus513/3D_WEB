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
            supabase.from('orders').select('*, items:order_items(*)').order('created_at', { ascending: false }),
            supabase.from('profiles').select('id, role'),
            supabase.from('products').select('id'),
        ]);

        const orders = ordersRes.data || [];
        const allProfiles = customersRes.data || [];
        const products = productsRes.data || [];

        // Filter out admins
        const customers = allProfiles.filter((p: { role?: string }) => p.role !== 'admin');

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
            .filter(o => isCurrentMonth(o.created_at))
            .reduce((sum, o) => sum + getRevenue(o), 0);

        // Count pending orders
        const pendingOrders = orders.filter(o => o.status === 'pending').length;

        // Transform for Recent Orders
        const recentOrders = orders.slice(0, 5).map(o => ({
            id: o.id,
            order_code: o.order_code || o.cart_code,
            order_type: o.order_type || 'ready_made',
            total: Number(o.total_amount || 0),
            status: o.status,
            customer_name: o.shipping_address?.full_name || 'Khách',
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
