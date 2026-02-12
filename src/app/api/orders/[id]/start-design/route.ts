/**
 * Admin API: Start Design
 * POST /api/orders/[id]/start-design
 * Changes status: confirmed → designing
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

    const { createLogger } = await import('@/lib/logger');
    const log = createLogger('start-design');
    log.info('Starting design', { orderId });

    try {
        const supabase = getAdminSupabase();

        // Find order in orders table (custom orders are now in orders table)
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('id, status, order_type')
            .eq('id', orderId)
            .single();

        if (fetchError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Validate current status
        if (order.status !== 'confirmed') {
            return NextResponse.json({
                error: `Cannot start design. Current status: ${order.status}. Expected: confirmed`
            }, { status: 400 });
        }

        // Update status to designing
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'designing',
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('[StartDesign] Update error:', updateError);
            return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
        }

        // Revalidate cache
        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');
        revalidatePath('/sys_internal/orders', 'page');

        return NextResponse.json({
            success: true,
            message: 'Design started',
            new_status: 'designing'
        });
    } catch (error) {
        console.error('[StartDesign] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
