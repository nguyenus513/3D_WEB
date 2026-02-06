import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/admin-guard';

interface MonthlyData {
    month: number;
    year: number;
    depositRevenue: number;
    deliveredRevenue: number;
    totalRevenue: number;
    orderCount: number;
    deliveredCount: number;
    pendingCount: number;
}

/**
 * GET /api/admin/revenue
 * Fetch revenue analytics data
 * Query params: month, year
 */
export async function GET(request: Request) {
    try {
        // SECURITY: Verify admin access
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const { searchParams } = new URL(request.url);
        const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
        const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

        const supabase = getAdminSupabase();

        // Fetch from ALL order tables in parallel
        const [ordersRes, customRes, printRes] = await Promise.all([
            supabase.from('orders').select('*').order('created_at', { ascending: false }),
            supabase.from('custom_orders').select('*').order('created_at', { ascending: false }),
            supabase.from('print_orders').select('*').order('created_at', { ascending: false }),
        ]);

        if (ordersRes.error) console.error('Error fetching orders:', ordersRes.error);
        if (customRes.error) console.error('Error fetching custom_orders:', customRes.error);
        if (printRes.error) console.error('Error fetching print_orders:', printRes.error);

        const orders = ordersRes.data || [];
        const customOrders = customRes.data || [];
        const printOrders = printRes.data || [];

        // Helper to check if date is in target month
        const isInMonth = (dateStr: string, m: number, y: number) => {
            const d = new Date(dateStr);
            return d.getMonth() + 1 === m && d.getFullYear() === y;
        };

        // Calculate revenue for selected month from ALL tables
        const calculateMonthRevenue = (m: number, y: number): MonthlyData => {
            let depositRevenue = 0;
            let deliveredRevenue = 0;
            let deliveredCount = 0;
            let pendingCount = 0;
            let orderCount = 0;

            // 1. Legacy orders table
            orders.filter(o => isInMonth(o.created_at, m, y)).forEach((o: any) => {
                orderCount++;
                if (o.status === 'delivered') {
                    deliveredRevenue += Number(o.total_amount || o.total || 0);
                    deliveredCount++;
                } else if (o.deposit_paid && !['pending', 'cancelled'].includes(o.status)) {
                    depositRevenue += Number(o.deposit_amount) || Number(o.total_amount || o.total || 0) * 0.5;
                    pendingCount++;
                }
            });

            // 2. Custom orders table
            customOrders.filter(o => isInMonth(o.created_at, m, y)).forEach((o: any) => {
                orderCount++;
                const total = Number(o.total || o.estimated_price || 0);
                if (o.status === 'delivered') {
                    deliveredRevenue += total;
                    deliveredCount++;
                } else if (['confirmed', 'processing', 'designing', 'review', 'approved', 'producing', 'shipping'].includes(o.status)) {
                    // Assume 50% deposit for confirmed custom orders
                    depositRevenue += total * 0.5;
                    pendingCount++;
                }
            });

            // 3. Print orders table
            printOrders.filter(o => isInMonth(o.created_at, m, y)).forEach((o: any) => {
                orderCount++;
                const total = Number(o.total_price || 0);
                if (o.status === 'delivered') {
                    deliveredRevenue += total;
                    deliveredCount++;
                } else if (['confirmed', 'processing', 'printing', 'shipping'].includes(o.status)) {
                    // Print orders are usually paid in full upfront
                    depositRevenue += total;
                    pendingCount++;
                }
            });

            return {
                month: m,
                year: y,
                depositRevenue,
                deliveredRevenue,
                totalRevenue: depositRevenue + deliveredRevenue,
                orderCount,
                deliveredCount,
                pendingCount,
            };
        };

        // Current month data
        const currentMonth = calculateMonthRevenue(month, year);

        // Previous month data for comparison
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = year - 1;
        }
        const previousMonth = calculateMonthRevenue(prevMonth, prevYear);

        // Percentage change
        const percentChange = previousMonth.totalRevenue > 0
            ? ((currentMonth.totalRevenue - previousMonth.totalRevenue) / previousMonth.totalRevenue) * 100
            : currentMonth.totalRevenue > 0 ? 100 : 0;

        // Yearly data for chart (all 12 months)
        const yearlyData = [];
        for (let m = 1; m <= 12; m++) {
            const monthData = calculateMonthRevenue(m, year);
            yearlyData.push({
                month: m,
                revenue: monthData.totalRevenue,
                deliveredRevenue: monthData.deliveredRevenue,
                depositRevenue: monthData.depositRevenue,
            });
        }

        // Gather all user IDs for profile lookup
        const allUserIds = new Set([
            ...orders.map((o: any) => o.user_id),
            ...customOrders.map((o: any) => o.user_id),
            ...printOrders.map((o: any) => o.user_id),
        ].filter(Boolean));

        let profileMap = new Map<string, string>();
        if (allUserIds.size > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', Array.from(allUserIds));
            if (profiles) {
                profiles.forEach((p: any) => profileMap.set(p.id, p.full_name));
            }
        }

        // Merge and transform orders for detailed list (top 20)
        const allOrdersThisMonth = [
            ...orders.filter((o: any) => isInMonth(o.created_at, month, year)).map((o: any) => ({
                id: o.id,
                order_code: o.order_code,
                total: Number(o.total_amount || o.total || 0),
                deposit_amount: Number(o.deposit_amount || 0),
                status: o.status,
                user_id: o.user_id,
                shipping_address: o.shipping_address_snapshot,
                created_at: o.created_at,
                order_type: 'ready_made',
            })),
            ...customOrders.filter((o: any) => isInMonth(o.created_at, month, year)).map((o: any) => ({
                id: o.id,
                order_code: o.order_number || o.order_code || o.id.slice(0, 8),
                total: Number(o.total || o.estimated_price || 0),
                deposit_amount: Number(o.total || o.estimated_price || 0) * 0.5,
                status: o.status,
                user_id: o.user_id,
                shipping_address: o.shipping_address,
                created_at: o.created_at,
                order_type: 'custom',
            })),
            ...printOrders.filter((o: any) => isInMonth(o.created_at, month, year)).map((o: any) => ({
                id: o.id,
                order_code: o.order_number || o.id.slice(0, 8),
                total: Number(o.total_price || 0),
                deposit_amount: Number(o.total_price || 0),
                status: o.status,
                user_id: o.user_id,
                shipping_address: o.shipping_address,
                created_at: o.created_at,
                order_type: 'printing',
            })),
        ];

        // Sort by created_at DESC, filter to revenue-generating, take 20
        const monthOrders = allOrdersThisMonth
            .filter(o => o.status === 'delivered' || !['pending', 'cancelled'].includes(o.status))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 20)
            .map(o => {
                let shippingAddr = o.shipping_address;
                if (typeof shippingAddr === 'string') {
                    try { shippingAddr = JSON.parse(shippingAddr); } catch { shippingAddr = null; }
                }
                const customerName =
                    (o.user_id && profileMap.get(o.user_id)) ||
                    (shippingAddr && typeof shippingAddr === 'object' && (shippingAddr as any)?.full_name) ||
                    'Khách';
                return {
                    id: o.id,
                    order_code: o.order_code,
                    total: o.total,
                    deposit_amount: o.deposit_amount,
                    status: o.status,
                    customer_name: customerName,
                    created_at: o.created_at,
                    order_type: o.order_type,
                };
            });

        return NextResponse.json({
            currentMonth,
            previousMonth: {
                month: prevMonth,
                year: prevYear,
                totalRevenue: previousMonth.totalRevenue,
            },
            percentChange: Math.round(percentChange * 10) / 10,
            yearlyData,
            orders: monthOrders,
        });
    } catch (error) {
        console.error('Revenue API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
