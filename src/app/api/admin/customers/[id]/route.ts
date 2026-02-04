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

        // Fetch orders from all tables in parallel
        const [ordersRes, customRes, printRes, masterRes] = await Promise.all([
            supabase.from('orders').select('*').eq('user_id', id).order('created_at', { ascending: false }),
            supabase.from('custom_orders').select('*').eq('user_id', id).order('created_at', { ascending: false }),
            supabase.from('print_orders').select('*').eq('user_id', id).order('created_at', { ascending: false }),
            supabase.from('master_orders').select('*').eq('user_id', id).order('created_at', { ascending: false })
        ]);

        // Normalize and merge orders
        const allOrders = [
            ...(ordersRes.data || []).map((o: any) => ({
                id: o.id,
                order_code: o.order_code,
                total_amount: Number(o.total_amount || 0),
                status: o.status,
                created_at: o.created_at,
                source: 'orders'
            })),
            ...(customRes.data || []).map((o: any) => ({
                id: o.id,
                order_code: o.order_number || o.order_code,
                total_amount: Number(o.total || o.estimated_price || 0),
                status: o.status,
                created_at: o.created_at,
                source: 'custom_orders'
            })),
            ...(printRes.data || []).map((o: any) => ({
                id: o.id,
                order_code: o.order_number,
                total_amount: Number(o.total_price || 0),
                status: o.status,
                created_at: o.created_at,
                source: 'print_orders'
            })),
            ...(masterRes.data || []).map((o: any) => ({
                id: o.id,
                order_code: o.order_number,
                total_amount: Number(o.total || 0),
                status: o.status,
                created_at: o.created_at,
                source: 'master_orders'
            }))
        ];

        // Sort by newest first
        allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
