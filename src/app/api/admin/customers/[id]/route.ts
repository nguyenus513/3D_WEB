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

        // Fetch orders from unified orders table
        const { data: orders } = await supabase
            .from('orders')
            .select('*, items:order_items(*)')
            .eq('user_id', id)
            .order('created_at', { ascending: false });

        // Transform orders
        const allOrders = (orders || []).map((o: any) => ({
            id: o.id,
            order_code: o.order_code || o.cart_code,
            order_type: o.order_type || 'ready_made',
            total_amount: Number(o.total_amount || 0),
            status: o.status,
            payment_status: o.payment_status,
            created_at: o.created_at,
        }));

        return NextResponse.json({
            profile,
            addresses: addresses || [],
            orders: allOrders,
        });
    } catch (error) {
        console.error('Admin customer API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
