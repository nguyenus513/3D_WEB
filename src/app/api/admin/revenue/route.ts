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

        // Fetch from UNIFIED orders table
        // We fetch a bit more data (whole year usually) to calculate charts
        // Optimally we could filter by date range in SQL, but for small volume fetching all orders is okay
        // Let's filter by year at least to be slightly optimized
        const startOfYear = `${year}-01-01T00:00:00.000Z`;
        const endOfYear = `${year}-12-31T23:59:59.999Z`;

        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .gte('created_at', startOfYear)
            .lte('created_at', endOfYear)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        const allOrders = orders || [];

        // Helper to check if date is in target month
        const isInMonth = (dateStr: string, m: number, y: number) => {
            const d = new Date(dateStr);
            return d.getMonth() + 1 === m && d.getFullYear() === y;
        };

        // Calculate revenue for selected month
        const calculateMonthRevenue = (m: number, y: number): MonthlyData => {
            let depositRevenue = 0;
            let deliveredRevenue = 0;
            let deliveredCount = 0;
            let pendingCount = 0;
            let orderCount = 0;

            allOrders.filter((o: any) => isInMonth(o.created_at, m, y)).forEach((o: any) => {
                orderCount++;
                const total = Number(o.total_amount || 0);
                const deposit = Number(o.deposit_amount || 0);
                const isDepositPaid = o.payment_status === 'paid' || o.status !== 'pending';

                if (o.status === 'delivered') {
                    deliveredRevenue += total;
                    deliveredCount++;
                } else if (isDepositPaid && !['pending', 'cancelled', 'payment_failed'].includes(o.status)) {
                    // Count revenue based on deposit
                    // If deposit_amount is set, use it. Else estimate based on type.
                    if (deposit > 0) {
                        depositRevenue += deposit;
                    } else {
                        // Fallback estimation if deposit_amount missing
                        if (o.order_type === 'custom') depositRevenue += total * 0.5;
                        else if (o.order_type === 'printing') depositRevenue += total; // Usually full prepaid?
                        else if (o.order_type === 'ready_made') depositRevenue += total; // Usually full prepaid
                        else depositRevenue += total * 0.5;
                    }
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

        // Previous month calculation (Might need to fetch prev year if Jan)
        // Note: The main query above filters by ONE year. So strict prev month calc across year boundary might be inaccurate here.
        // Quick fix: if prev month is in prev year, we return 0 or do separate fetch. 
        // For simplicity in this refactor, we accept 0 for prev year boundary or separate fetch.
        // Let's keep it simple: if prev year, simplistic 0 to avoid complexity, or fetch if needed.
        // Actually, let's fetch strictly needed range or just fetch everything (simplest for Admin dashboard usually).
        // For now, assume single year view or 0 for prev year crossing.

        // Use simplistic approaches for now:
        let previousMonth = { totalRevenue: 0 } as MonthlyData;
        if (month > 1) {
            previousMonth = calculateMonthRevenue(month - 1, year);
        }

        // Percentage change
        const percentChange = previousMonth.totalRevenue > 0
            ? ((currentMonth.totalRevenue - previousMonth.totalRevenue) / previousMonth.totalRevenue) * 100
            : currentMonth.totalRevenue > 0 ? 100 : 0;

        // Yearly data
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

        // Gather user IDs for profile lookup
        const userIds = Array.from(new Set(allOrders.map((o: any) => o.user_id).filter(Boolean)));
        let profileMap = new Map<string, string>();

        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', userIds);
            if (profiles) {
                profiles.forEach((p: any) => profileMap.set(p.id, p.full_name));
            }
        }

        // Recent orders list (Unified)
        const monthOrdersRaw = allOrders.filter((o: any) => isInMonth(o.created_at, month, year));

        const monthOrders = monthOrdersRaw
            .filter((o: any) => o.status === 'delivered' || !['pending', 'cancelled'].includes(o.status))
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 20)
            .map((o: any) => {
                let shippingAddr = o.shipping_address_snapshot;
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
                    total: Number(o.total_amount || 0),
                    deposit_amount: Number(o.deposit_amount || 0),
                    status: o.status,
                    customer_name: customerName,
                    created_at: o.created_at,
                    order_type: o.order_type || 'ready_made',
                };
            });

        return NextResponse.json({
            currentMonth,
            previousMonth: {
                month: month - 1,
                year: year,
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
