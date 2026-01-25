/**
 * Admin Demo Image Upload API
 * POST /api/admin/orders/[id]/demo-image - Upload demo/preview image for customer review
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { uploadToGoogleDrive } from '@/lib/google-drive';

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

        const supabase = getAdminSupabase();

        // Get order info
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('order_code, user_id, profiles:user_id(customer_code, email)')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

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

        // Upload to Google Drive
        const customerCode = (order.profiles as { customer_code?: string })?.customer_code || 'UNKNOWN';
        const uploadResult = await uploadToGoogleDrive(file, {
            type: 'demo',
            customerCode,
            orderCode: order.order_code,
        });

        if (!uploadResult.success || !uploadResult.file) {
            return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
        }

        // Save demo_image_url to order
        const demoImageUrl = `https://drive.google.com/thumbnail?id=${uploadResult.file.id}&sz=w800`;

        const { error: updateError } = await supabase
            .from('orders')
            .update({
                demo_image_url: demoImageUrl,
                status: 'review',  // Auto-set status to review
                review_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('Update order error:', updateError);
            return NextResponse.json({ error: 'Failed to save demo image URL' }, { status: 500 });
        }

        // TODO: Send email notification to customer
        // const customerEmail = (order.profiles as { email?: string })?.email;
        // if (customerEmail) {
        //     await sendReviewNotification(customerEmail, order.order_code, demoImageUrl);
        // }

        return NextResponse.json({
            success: true,
            demo_image_url: demoImageUrl,
            file_id: uploadResult.file.id,
        });
    } catch (error) {
        console.error('Demo image upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
