/**
 * Admin Finished Product Images API
 * POST /api/admin/orders/[id]/finished-images - Upload finished product images
 * DELETE /api/admin/orders/[id]/finished-images - Remove a finished image by index
 *
 * Storage: Cloudflare R2
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/security/admin-guard';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { uploadToR2, isR2Configured } from '@/lib/storage/r2';
import { generateStudioR2Key, getExtension } from '@/lib/naming';

interface FinishedImage {
    url: string;
    label: string;
    uploaded_at: string;
}

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const { id: orderId } = await props.params;
        if (!orderId) {
            return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
        }

        if (!isR2Configured()) {
            return NextResponse.json({ error: 'R2 storage not configured' }, { status: 500 });
        }

        const supabase = getAdminSupabase();

        const { data: order, error: findError } = await supabase
            .from('orders')
            .select('id, order_code, cart_code, finished_images')
            .eq('id', orderId)
            .maybeSingle();

        if (findError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const orderCode = order.order_code || order.cart_code;

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const label = (formData.get('label') as string) || 'Thành phẩm';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const existingImages: FinishedImage[] = Array.isArray(order.finished_images) ? order.finished_images : [];
        const imageIndex = existingImages.length + 1;
        const ext = getExtension(file.name);

        // Upload to R2 using studio naming convention
        // e.g. orders/C494D49D/final/ORD-C494D49D_FINAL_FULL_V01_01.jpg
        const r2Key = generateStudioR2Key({
            orderCode: orderCode,
            stage: 'FINAL',
            version: 1,
            index: imageIndex,
            extension: ext,
        });
        const { url: imageUrl } = await uploadToR2(buffer, r2Key, file.type, {
            orderId,
            orderCode,
            type: 'finished',
            index: String(imageIndex),
        });

        const newImage: FinishedImage = {
            url: imageUrl,
            label,
            uploaded_at: new Date().toISOString(),
        };

        const updatedImages = [...existingImages, newImage];

        const { error: updateError } = await supabase
            .from('orders')
            .update({
                finished_images: updatedImages,
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('[FinishedUpload] Update failed:', updateError);
            return NextResponse.json({ error: 'Failed to update: ' + updateError.message }, { status: 500 });
        }

        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');
        revalidatePath('/sys_internal/orders', 'page');

        return NextResponse.json({
            success: true,
            image: newImage,
            total_images: updatedImages.length,
            finished_images: updatedImages,
        });
    } catch (error) {
        console.error('[FinishedUpload] Error:', error);
        return NextResponse.json({ error: 'Upload failed: ' + (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const { id: orderId } = await props.params;
        const body = await request.json().catch(() => ({}));
        const imageIndex = body.index ?? -1;

        const supabase = getAdminSupabase();

        const { data: order, error: findError } = await supabase
            .from('orders')
            .select('id, finished_images')
            .eq('id', orderId)
            .maybeSingle();

        if (findError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const images: FinishedImage[] = Array.isArray(order.finished_images) ? order.finished_images : [];
        if (imageIndex < 0 || imageIndex >= images.length) {
            return NextResponse.json({ error: 'Invalid image index' }, { status: 400 });
        }

        const updatedImages = images.filter((_, i) => i !== imageIndex);

        const { error: updateError } = await supabase
            .from('orders')
            .update({
                finished_images: updatedImages,
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        if (updateError) {
            return NextResponse.json({ error: 'Update failed: ' + updateError.message }, { status: 500 });
        }

        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');

        return NextResponse.json({
            success: true,
            finished_images: updatedImages,
            total_images: updatedImages.length,
        });
    } catch (error) {
        return NextResponse.json({ error: 'Delete failed: ' + (error as Error).message }, { status: 500 });
    }
}
