import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/admin-guard';

/**
 * GET /api/admin/customers
 * Fetch all customers using admin privileges (bypasses RLS)
 */
export async function GET(request: NextRequest) {
    try {
        // SECURITY: Verify admin access
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const supabase = getAdminSupabase();

        // Fetch all profiles
        const { data: profiles, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching profiles:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Filter out admins
        const customers = (profiles || []).filter((p: { role?: string }) => p.role !== 'admin');

        // Fetch order stats for each customer
        const customersWithStats = await Promise.all(
            customers.map(async (profile: { id: string; name?: string; email?: string; phone?: string; customer_code?: string; instagram_username?: string; created_at: string }) => {
                const { data: orders } = await supabase
                    .from('orders')
                    .select('total_amount, created_at')
                    .eq('user_id', profile.id)
                    .order('created_at', { ascending: false });

                const orderCount = orders?.length || 0;
                const totalSpent = orders?.reduce((sum: number, o: { total_amount?: number }) => sum + Number(o.total_amount || 0), 0) || 0;
                const lastOrderDate = orders?.[0]?.created_at;

                return {
                    id: profile.id,
                    name: profile.name || null,
                    email: profile.email || null,
                    phone: profile.phone || null,
                    customer_code: profile.customer_code || null,
                    instagram_username: profile.instagram_username || null,
                    created_at: profile.created_at,
                    order_count: orderCount,
                    total_spent: totalSpent,
                    last_order_date: lastOrderDate || null,
                };
            })
        );

        return NextResponse.json({ customers: customersWithStats });
    } catch (error) {
        console.error('Admin customers API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

