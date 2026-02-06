/**
 * Admin API: Ship Order
 * POST /api/orders/[id]/ship
 * Changes status: producing → shipping
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const orderId = params.id;

    console.log(`[ShipOrder] Shipping order: ${orderId}`);

    try {
        const body = await request.json().catch(() => ({}));
        const { tracking_number, carrier } = body;

        const supabase = getAdminSupabase();

        // Find order
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('id, status')
            .eq('id', orderId)
            .single();

        if (fetchError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Validate current status
        if (order.status !== 'producing') {
            return NextResponse.json({
                error: `Cannot ship. Current status: ${order.status}. Expected: producing`
            }, { status: 400 });
        }

        // Update status to shipping
        const updateData: any = {
            status: 'shipping',
            updated_at: new Date().toISOString()
        };

        if (tracking_number) updateData.tracking_number = tracking_number;
        if (carrier) updateData.carrier = carrier;

        const { error: updateError } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId);

        if (updateError) {
            console.error('[ShipOrder] Update error:', updateError);
            return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
        }

        // Revalidate cache
        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');
        revalidatePath('/sys_internal/orders', 'page');
        revalidatePath(`/account/orders/${orderId}`, 'page');

        return NextResponse.json({
            success: true,
            message: 'Order shipped',
            new_status: 'shipping'
        });
    } catch (error) {
        console.error('[ShipOrder] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
