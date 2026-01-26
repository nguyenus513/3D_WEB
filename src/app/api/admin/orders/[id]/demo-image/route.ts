/**
 * Admin Demo Image Upload API
 * POST /api/admin/orders/[id]/demo-image - Upload demo/preview image for customer review
 * 
 * Storage: Cloudflare R2 (fast serving)
 * After order completes: Will be migrated to Google Drive via archive API
 * 
 * File naming: {orderCode}-0.{index}.{ext}
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { uploadToR2, generateReviewR2Key, isR2Configured } from '@/lib/storage/r2';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verify admin
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const { id: orderId } = await params;
        if (!orderId) {
            return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
        }

        // Check R2 configuration
        if (!isR2Configured()) {
            return NextResponse.json({ error: 'R2 storage not configured' }, { status: 500 });
        }

        const supabase = getAdminSupabase();

        // Get order info and count existing demo images
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('order_code, user_id, profiles:user_id(customer_code, email)')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Get count of existing demo files for this order to determine index
        const { count: existingDemos } = await supabase
            .from('order_files')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', orderId)
            .eq('file_type', 'demo');

        const demoIndex = (existingDemos || 0) + 1;

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

        // Generate R2 key using new review naming convention: {orderCode}-0.{index}.{ext}
        const r2Key = generateReviewR2Key(order.order_code, demoIndex, ext);
        const { url: demoImageUrl } = await uploadToR2(buffer, r2Key, file.type, {
            orderId,
            orderCode: order.order_code,
            type: 'demo',
        });

        // Save demo_image_url to order
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                demo_image_url: demoImageUrl,
                status: 'review',  // Auto-set status to review when demo uploaded
                review_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('Update order error:', updateError);
            return NextResponse.json({ error: 'Failed to save demo image URL' }, { status: 500 });
        }

        // Also save to order_files for tracking
        await supabase.from('order_files').insert({
            order_id: orderId,
            file_id: r2Key,  // Use R2 key as file_id 
            file_name: file.name,
            file_type: 'demo',
        });

        // TODO: Send email notification to customer
        // const customerEmail = (order.profiles as { email?: string })?.email;
        // if (customerEmail) {
        //     await sendReviewNotification(customerEmail, order.order_code, demoImageUrl);
        // }

        return NextResponse.json({
            success: true,
            demo_image_url: demoImageUrl,
            r2_key: r2Key,
        });
    } catch (error) {
        console.error('Demo image upload error:', error);
        return NextResponse.json({ error: 'Upload failed: ' + (error as Error).message }, { status: 500 });
    }
}
