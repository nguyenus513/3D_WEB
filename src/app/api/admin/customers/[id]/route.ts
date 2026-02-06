import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { auth } from '@/auth';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Check if user is admin
        const session = await auth();
        const userRole = (session?.user as { role?: string })?.role;

        if (!session?.user || userRole !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const supabase = getAdminSupabase();

        // Fetch profile with service role (bypass RLS)
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json(
                { error: 'Không tìm thấy khách hàng' },
                { status: 404 }
            );
        }

        // Fetch addresses with service role (bypass RLS)
        const { data: addresses } = await supabase
            .from('addresses')
            .select('*')
            .eq('user_id', id)
            .order('is_default', { ascending: false });

        // Fetch orders from UNIFIED orders table
        const { data: allOrders, error: ordersError } = await supabase
            .from('orders')
            .select('id, order_code, order_type, total_amount, status, created_at')
            .eq('user_id', id)
            .order('created_at', { ascending: false });

        if (ordersError) {
            console.error('Error fetching customer orders:', ordersError);
            // We can return empty list or error, let's log and return empty list to not break profile view
        }

        const orders = (allOrders || []).map((o: any) => ({
            id: o.id,
            order_code: o.order_code,
            total_amount: Number(o.total_amount || 0),
            status: o.status,
            created_at: o.created_at,
            order_type: o.order_type || 'ready_made',
            source: 'orders'
        }));



        return NextResponse.json({
            profile,
            addresses: addresses || [],
            orders: orders,
        });
    } catch (error) {
        console.error('Admin customer API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
