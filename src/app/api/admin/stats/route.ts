import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';

/**
 * GET /api/admin/stats
 * Fetch dashboard stats using admin privileges (bypasses RLS)
 */
export async function GET() {
    try {
        const supabase = getAdminSupabase();

        // Fetch all data in parallel
        const [ordersRes, customersRes, productsRes] = await Promise.all([
            supabase.from('orders').select('*').order('created_at', { ascending: false }),
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
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();

        // Calculate revenue for current month:
        // - 50% deposit when order is paid (deposit_paid = true)
        // - Full amount when order is delivered
        const monthlyRevenue = orders
            .filter((o: { created_at: string }) => {
                const orderDate = new Date(o.created_at);
                return orderDate.getMonth() + 1 === currentMonth && orderDate.getFullYear() === currentYear;
            })
            .reduce((sum: number, o: { status: string; deposit_paid: boolean; deposit_amount: number; total: number }) => {
                let revenue = 0;

                // If delivered, count full amount
                if (o.status === 'delivered') {
                    revenue = Number(o.total);
                }
                // If paid but not delivered yet, count deposit amount
                else if (o.deposit_paid && o.status !== 'pending' && o.status !== 'cancelled') {
                    revenue = Number(o.deposit_amount) || Number(o.total) * 0.5;
                }

                return sum + revenue;
            }, 0);

        const pendingOrders = orders.filter((o: { status: string }) => o.status === 'pending').length;

        // Recent orders
        const recentOrders = orders.slice(0, 5).map((o: {
            id: string;
            order_code: string;
            order_type: string;
            total: number;
            status: string;
            created_at: string;
            shipping_address?: { full_name?: string } | null
        }) => ({
            id: o.id,
            order_code: o.order_code,
            order_type: o.order_type,
            total: Number(o.total),
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
