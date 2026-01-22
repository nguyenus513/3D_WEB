import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';

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
        const { searchParams } = new URL(request.url);
        const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
        const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

        const supabase = getAdminSupabase();

        // Fetch all orders
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Calculate revenue for selected month
        const calculateMonthRevenue = (m: number, y: number): MonthlyData => {
            const monthOrders = (orders || []).filter((o: { created_at: string }) => {
                const d = new Date(o.created_at);
                return d.getMonth() + 1 === m && d.getFullYear() === y;
            });

            let depositRevenue = 0;
            let deliveredRevenue = 0;
            let deliveredCount = 0;
            let pendingCount = 0;

            monthOrders.forEach((o: {
                status: string;
                deposit_paid: boolean;
                deposit_amount: number;
                total: number
            }) => {
                if (o.status === 'delivered') {
                    deliveredRevenue += Number(o.total);
                    deliveredCount++;
                } else if (o.deposit_paid && o.status !== 'pending' && o.status !== 'cancelled') {
                    depositRevenue += Number(o.deposit_amount) || Number(o.total) * 0.5;
                    pendingCount++;
                }
            });

            return {
                month: m,
                year: y,
                depositRevenue,
                deliveredRevenue,
                totalRevenue: depositRevenue + deliveredRevenue,
                orderCount: monthOrders.length,
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

        // Fetch profiles for customer names
        const userIds = [...new Set((orders || []).map((o: { user_id?: string }) => o.user_id).filter(Boolean))];
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);

        const profileMap = new Map((profiles || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));

        // Orders for selected month (detailed list)
        const monthOrders = (orders || [])
            .filter((o: { created_at: string }) => {
                const d = new Date(o.created_at);
                return d.getMonth() + 1 === month && d.getFullYear() === year;
            })
            .filter((o: { status: string; deposit_paid: boolean }) =>
                o.status === 'delivered' || (o.deposit_paid && o.status !== 'pending' && o.status !== 'cancelled')
            )
            .slice(0, 20)
            .map((o: {
                id: string;
                order_code: string;
                total: number;
                deposit_amount: number;
                status: string;
                created_at: string;
                user_id?: string;
                shipping_address?: { full_name?: string } | string | null;
            }) => {
                // Parse shipping_address if it's a string
                let shippingAddr = o.shipping_address;
                if (typeof shippingAddr === 'string') {
                    try { shippingAddr = JSON.parse(shippingAddr); } catch { shippingAddr = null; }
                }

                // Get customer name: profile > shipping_address > default
                const customerName =
                    (o.user_id && profileMap.get(o.user_id)) ||
                    (shippingAddr && typeof shippingAddr === 'object' && shippingAddr?.full_name) ||
                    'Khách';

                return {
                    id: o.id,
                    order_code: o.order_code,
                    total: Number(o.total),
                    deposit_amount: Number(o.deposit_amount),
                    status: o.status,
                    customer_name: customerName,
                    created_at: o.created_at,
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
