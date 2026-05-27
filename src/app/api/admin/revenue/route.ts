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
 * Fetch revenue analytics from unified orders table
 */
export async function GET(request: Request) {
    try {
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const { searchParams } = new URL(request.url);
        const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
        const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

        const supabase = getAdminSupabase();

        // Fetch from unified orders table
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error('Error fetching orders:', error);

        const allOrders = orders || [];

        const isInMonth = (dateStr: string, m: number, y: number) => {
            const d = new Date(dateStr);
            return d.getMonth() + 1 === m && d.getFullYear() === y;
        };

        const calculateMonthRevenue = (m: number, y: number): MonthlyData => {
            let depositRevenue = 0;
            let deliveredRevenue = 0;
            let deliveredCount = 0;
            let pendingCount = 0;
            let orderCount = 0;

            allOrders.filter((o: any) => isInMonth(o.created_at, m, y)).forEach((o: any) => {
                orderCount++;
                const total = Number(o.total_amount || 0);
                if (o.status === 'delivered' || o.status === 'completed') {
                    deliveredRevenue += total;
                    deliveredCount++;
                } else if (['paid', 'confirmed', 'processing', 'producing', 'shipping'].includes(o.payment_status) ||
                    ['confirmed', 'processing', 'producing', 'shipping'].includes(o.status)) {
                    depositRevenue += Number(o.deposit_amount || total * 0.5);
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

        const currentMonth = calculateMonthRevenue(month, year);

        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = year - 1;
        }
        const previousMonth = calculateMonthRevenue(prevMonth, prevYear);

        const percentChange = previousMonth.totalRevenue > 0
            ? ((currentMonth.totalRevenue - previousMonth.totalRevenue) / previousMonth.totalRevenue) * 100
            : currentMonth.totalRevenue > 0 ? 100 : 0;

        // Yearly data for chart
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

        // Profile lookup
        const allUserIds = new Set(allOrders.map((o: any) => o.user_id).filter(Boolean));
        let profileMap = new Map<string, string>();
        if (allUserIds.size > 0) {
            const { data: profiles } = await supabase
                .from('users')
                .select('id, name')
                .in('id', Array.from(allUserIds));
            if (profiles) {
                profiles.forEach((p: any) => profileMap.set(p.id, p.name));
            }
        }

        // Orders for selected month
        const monthOrders = allOrders
            .filter((o: any) => isInMonth(o.created_at, month, year))
            .filter((o: any) => !['pending', 'cancelled'].includes(o.status))
            .slice(0, 20)
            .map((o: any) => {
                const shipping = o.shipping_address || o.shipping_address_snapshot || {};
                return ({
                id: o.id,
                order_code: o.order_code || o.cart_code,
                total: Number(o.total_amount || 0),
                deposit_amount: Number(o.deposit_amount || 0),
                status: o.status,
                customer_name: (o.user_id && profileMap.get(o.user_id)) || shipping.full_name || 'Chưa có tên khách hàng',
                created_at: o.created_at,
                order_type: o.order_type || 'ready_made',
            });
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

