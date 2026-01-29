import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/admin-guard';

/**
 * GET /api/admin/stats
 * Fetch dashboard stats using admin privileges (bypasses RLS)
 */
export async function GET(request: NextRequest) {
    try {
        // SECURITY: Verify admin access
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const supabase = getAdminSupabase();

        // Fetch all data in parallel (including order_child)
        const [ordersRes, childOrdersRes, customersRes, productsRes] = await Promise.all([
            supabase.from('orders').select('*').order('created_at', { ascending: false }),
            supabase.from('order_child').select('*').order('created_at', { ascending: false }),
            supabase.from('profiles').select('id, role'),
            supabase.from('products').select('id'),
        ]);

        const legacyOrders = ordersRes.data || [];
        const childOrders = childOrdersRes.data || [];
        const allProfiles = customersRes.data || [];
        const products = productsRes.data || [];

        // Filter out admins
        const customers = allProfiles.filter((p: { role?: string }) => p.role !== 'admin');

        // Get current month
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();

        // Calculate revenue for current month from legacy orders
        const legacyMonthlyRevenue = legacyOrders
            .filter((o: { created_at: string }) => {
                const orderDate = new Date(o.created_at);
                return orderDate.getMonth() + 1 === currentMonth && orderDate.getFullYear() === currentYear;
            })
            .reduce((sum: number, o: { status: string; deposit_paid: boolean; deposit_amount: number; total: number }) => {
                let revenue = 0;
                if (o.status === 'delivered') {
                    revenue = Number(o.total);
                } else if (o.deposit_paid && o.status !== 'pending' && o.status !== 'cancelled') {
                    revenue = Number(o.deposit_amount) || Number(o.total) * 0.5;
                }
                return sum + revenue;
            }, 0);

        // Calculate revenue from child orders (count as pending payment until confirmed)
        const childMonthlyRevenue = childOrders
            .filter((o: { created_at: string }) => {
                const orderDate = new Date(o.created_at);
                return orderDate.getMonth() + 1 === currentMonth && orderDate.getFullYear() === currentYear;
            })
            .reduce((sum: number, o: { status: string; total_price: number }) => {
                // Count as revenue if status is confirmed, processing, or delivered
                if (['confirmed', 'processing', 'delivered', 'completed'].includes(o.status)) {
                    return sum + Number(o.total_price);
                }
                return sum;
            }, 0);

        const monthlyRevenue = legacyMonthlyRevenue + childMonthlyRevenue;

        // Count pending orders from both tables
        const legacyPending = legacyOrders.filter((o: { status: string }) => o.status === 'pending').length;
        const childPending = childOrders.filter((o: { status: string }) => o.status === 'pending').length;
        const pendingOrders = legacyPending + childPending;

        // Transform child orders to unified format
        const transformedChildOrders = childOrders.map((o: {
            id: string;
            code_child: string;
            product_type: string;
            total_price: number;
            status: string;
            created_at: string;
            product_name: string;
        }) => ({
            id: o.id,
            order_code: o.code_child,
            order_type: o.product_type || 'product',
            total: Number(o.total_price),
            status: o.status,
            customer_name: o.product_name || 'Đơn hàng mới',
            created_at: o.created_at,
            source: 'order_child',
        }));

        // Transform legacy orders
        const transformedLegacyOrders = legacyOrders.map((o: {
            id: string;
            order_code: string;
            order_type: string;
            total: number;
            status: string;
            created_at: string;
            shipping_address?: { full_name?: string } | null;
        }) => ({
            id: o.id,
            order_code: o.order_code,
            order_type: o.order_type,
            total: Number(o.total),
            status: o.status,
            customer_name: o.shipping_address?.full_name || 'Khách',
            created_at: o.created_at,
            source: 'orders',
        }));

        // Merge and sort by created_at, take first 5
        const recentOrders = [...transformedChildOrders, ...transformedLegacyOrders]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5);

        const totalOrders = legacyOrders.length + childOrders.length;

        return NextResponse.json({
            stats: {
                revenue: monthlyRevenue,
                currentMonth,
                orders: totalOrders,
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
