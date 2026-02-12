/**
 * Admin API: Complete Order
 * POST /api/orders/[id]/complete
 * Changes status: shipping → delivered
 * Triggers R2 → Google Drive migration & cleanup
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { migrateOrderToArchive } from '@/lib/storage/migrate-to-drive';

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const orderId = params.id;

    const { createLogger } = await import('@/lib/logger');
    const log = createLogger('complete-order');
    log.info('Completing order', { orderId });

    try {
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
        if (order.status !== 'shipping') {
            return NextResponse.json({
                error: `Cannot complete. Current status: ${order.status}. Expected: shipping`
            }, { status: 400 });
        }

        // Update status to delivered
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'delivered',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('[CompleteOrder] Update error:', updateError);
            return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
        }

        // Migrate files from R2 to Google Drive & cleanup R2
        // This runs in background to not block the response
        migrateOrderToArchive(orderId)
            .then((result) => {
                if (result.success) {
                    log.info('Migration complete', { migratedFiles: result.migratedFiles });
                } else {
                    console.warn(`[CompleteOrder] Migration issues:`, result.errors);
                }
            })
            .catch((err) => {
                console.error('[CompleteOrder] Migration failed:', err);
            });

        // Revalidate cache
        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');
        revalidatePath('/sys_internal/orders', 'page');
        revalidatePath(`/account/orders/${orderId}`, 'page');

        return NextResponse.json({
            success: true,
            message: 'Order completed, files migrating to archive',
            new_status: 'delivered'
        });
    } catch (error) {
        console.error('[CompleteOrder] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

