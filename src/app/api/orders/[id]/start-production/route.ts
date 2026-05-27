/**
 * Admin API: Start Production
 * POST /api/orders/[id]/start-production
 * Changes status: approved → producing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { sendOrderStatusEmail } from '@/lib/email/orderStatusEmail';

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const orderId = params.id;

    const { createLogger } = await import('@/lib/logger');
    const log = createLogger('start-production');
    log.info('Starting production', { orderId });

    try {
        const supabase = getAdminSupabase();

        // Find order
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('id, status, order_type')
            .eq('id', orderId)
            .single();

        if (fetchError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Validate current status
        if (order.status !== 'approved') {
            return NextResponse.json({
                error: `Cannot start production. Current status: ${order.status}. Expected: approved`
            }, { status: 400 });
        }

        // Update status to producing
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'producing',
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('[StartProduction] Update error:', updateError);
            return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
        }

        await sendOrderStatusEmail({
            orderId,
            oldStatus: order.status,
            newStatus: 'producing',
        });

        // Revalidate cache
        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');
        revalidatePath('/sys_internal/orders', 'page');

        return NextResponse.json({
            success: true,
            message: 'Production started',
            new_status: 'producing'
        });
    } catch (error) {
        console.error('[StartProduction] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
