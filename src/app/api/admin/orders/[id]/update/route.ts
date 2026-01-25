import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { auth } from '@/auth';

export async function PUT(
    request: NextRequest,
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
        const body = await request.json();

        const supabase = getAdminSupabase();

        // Update order with service role (bypass RLS)
        const { data: order, error } = await supabase
            .from('orders')
            .update(body)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Order update error:', error);
            return NextResponse.json(
                { error: 'Không thể cập nhật đơn hàng: ' + error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, order });
    } catch (error) {
        console.error('Admin order update error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
