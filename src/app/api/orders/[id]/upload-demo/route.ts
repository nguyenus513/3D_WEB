/**
 * Admin API: Upload Demo
 * POST /api/orders/[id]/upload-demo
 * Changes status: designing → review
 * Stores demo image URL and notifies user
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

    // Structured logging
    const { createLogger } = await import('@/lib/logger');
    const log = createLogger('upload-demo');
    log.info('Uploading demo', { orderId });

    try {
        const body = await request.json();
        const { demo_image_url } = body;

        if (!demo_image_url) {
            return NextResponse.json({ error: 'Demo image URL is required' }, { status: 400 });
        }

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

        // Validate current status (can be designing or review for re-upload)
        if (!['designing', 'review'].includes(order.status)) {
            return NextResponse.json({
                error: `Cannot upload demo. Current status: ${order.status}. Expected: designing or review`
            }, { status: 400 });
        }

        // Get current demo_images array
        const { data: currentOrder } = await supabase
            .from('orders')
            .select('demo_images')
            .eq('id', orderId)
            .single();

        const existingImages = (currentOrder?.demo_images as any[]) || [];
        const newImage = {
            url: demo_image_url,
            label: `Demo V${existingImages.length + 1}`,
            uploaded_at: new Date().toISOString(),
        };

        // Update status to review and append to demo_images array
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'review',
                demo_images: [...existingImages, newImage],
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('[UploadDemo] Update error:', updateError);
            return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
        }

        // Revalidate cache
        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');
        revalidatePath('/sys_internal/orders', 'page');
        revalidatePath(`/account/orders/${orderId}`, 'page');
        revalidatePath('/account/orders', 'page');

        return NextResponse.json({
            success: true,
            message: 'Demo uploaded, waiting for user approval',
            new_status: 'review'
        });
    } catch (error) {
        console.error('[UploadDemo] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
