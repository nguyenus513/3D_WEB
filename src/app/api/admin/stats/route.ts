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

        // Fetch all data in parallel from new schema tables
        // Only query UNIFIED 'orders' table
        const [ordersRes, customersRes, productsRes] = await Promise.all([
            supabase.from('orders').select('*').order('created_at', { ascending: false }),
            supabase.from('profiles').select('id, role, full_name'),
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

        // Helper to check if order is in current month
        const isCurrentMonth = (dateStr: string) => {
            const date = new Date(dateStr);
            return date.getMonth() + 1 === currentMonth && date.getFullYear() === currentYear;
        };

        // Helper to get revenue from an order (Unified)
        const getRevenue = (o: any) => {
            // Count revenue if paid or in active production/delivery state
            const isPaid = o.payment_status === 'paid';
            const isActive = !['pending', 'cancelled', 'payment_failed'].includes(o.status);

            if (isPaid || isActive) {
                // Prefer deposit_amount if set (actual cash in), else total_amount if delivered/paid
                if (o.status === 'delivered') return Number(o.total_amount || 0);
                return Number(o.deposit_amount || o.total_amount || 0);
            }
            return 0;
        };

        // Calculate Revenue
        const monthlyRevenue = orders.filter(o => isCurrentMonth(o.created_at)).reduce((sum, o) => sum + getRevenue(o), 0);

        // Count pending orders (Unified)
        const pendingOrders = orders.filter(o => o.status === 'pending').length;

        // Transform for Recent Orders
        // Map profiles for customer names
        const profileMap = new Map<string, string>();
        allProfiles.forEach((p: any) => profileMap.set(p.id, p.full_name));

        const recentOrders = orders
            .slice(0, 5)
            .map(o => {
                let customerName = 'Khách';
                if (o.user_id && profileMap.has(o.user_id)) {
                    customerName = profileMap.get(o.user_id)!;
                } else if (o.shipping_address_snapshot) {
                    // Try to parse if it's a string, or access directly if object
                    const addr = typeof o.shipping_address_snapshot === 'string'
                        ? JSON.parse(o.shipping_address_snapshot)
                        : o.shipping_address_snapshot;
                    if (addr?.full_name) customerName = addr.full_name;
                }

                return {
                    id: o.id,
                    order_code: o.order_code,
                    order_type: o.order_type || 'ready_made',
                    total: Number(o.total_amount || 0),
                    status: o.status,
                    customer_name: customerName,
                    created_at: o.created_at,
                    source: 'orders'
                };
            });

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
