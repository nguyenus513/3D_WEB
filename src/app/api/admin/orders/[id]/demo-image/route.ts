/**
 * Admin Demo Image Upload API
 * POST /api/admin/orders/[id]/demo-image - Upload demo/preview image for customer review
 * 
 * Storage: Cloudflare R2 (fast serving)
 * Uses unified orders table only
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/security/admin-guard';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { uploadToR2, generateReviewR2Key, isR2Configured } from '@/lib/storage/r2';

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        // Verify admin
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const { id: orderId } = await props.params;
        if (!orderId) {
            return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
        }

        // Check R2 configuration
        if (!isR2Configured()) {
            return NextResponse.json({ error: 'R2 storage not configured' }, { status: 500 });
        }

        const supabase = getAdminSupabase();

        // Find order in unified orders table
        const { data: order, error: findError } = await supabase
            .from('orders')
            .select('id, order_code, cart_code, user_id')
            .eq('id', orderId)
            .maybeSingle();

        if (findError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const orderCode = order.order_code || order.cart_code;

        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, WebP or GIF' }, { status: 400 });
        }

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Get file extension
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';

        // Generate R2 key and upload
        const r2Key = generateReviewR2Key(orderCode, 1, ext);
        const { url: demoImageUrl } = await uploadToR2(buffer, r2Key, file.type, {
            orderId,
            orderCode: orderCode,
            type: 'demo',
        });

        // Update order status to 'review'
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'review',
                demo_image_url: demoImageUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('[DemoUpload] Update failed:', updateError);
        }

        // Invalidate cache
        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');
        revalidatePath('/sys_internal/orders', 'page');

        return NextResponse.json({
            success: true,
            demo_image_url: demoImageUrl,
            r2_key: r2Key,
            status: 'review'
        });
    } catch (error) {
        console.error('[DemoUpload] Error:', error);
        return NextResponse.json({ error: 'Upload failed: ' + (error as Error).message }, { status: 500 });
    }
}
