/**
 * Admin Demo Image Upload API (Multi-Image)
 * POST /api/admin/orders/[id]/demo-image - Upload demo/preview images for customer review
 * 
 * Supports multiple images (multi-angle). Each upload appends to demo_images array.
 * Storage: Cloudflare R2 (fast serving)
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/security/admin-guard';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { uploadToR2, isR2Configured, deleteFromR2, extractR2KeyFromUrl } from '@/lib/storage/r2';
import { generateStudioR2Key, getExtension } from '@/lib/naming';

interface DemoImage {
    url: string;
    label: string;
    uploaded_at: string;
}

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

        // Find order - select minimal columns to avoid missing column errors
        // Note: 'cart_code' column might be missing in some environments, so we exclude it to be safe
        const { data: order, error: findError } = await supabase
            .from('orders')
            .select('id, order_code, user_id, demo_images')
            .eq('id', orderId)
            .maybeSingle();

        if (findError) {
            console.error('[DemoUpload] Supabase query error:', findError);
            return NextResponse.json({ error: 'Database error: ' + findError.message }, { status: 500 });
        }

        if (!order) {
            console.error('[DemoUpload] Order not found for ID:', orderId);
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const orderCode = order.order_code || order.id.slice(0, 8).toUpperCase();

        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const label = (formData.get('label') as string) || 'Demo';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type (browsers may report RAW as application/octet-stream)
        const validTypes = [
            'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff', 'image/svg+xml',
            'image/heic', 'image/heif', 'image/avif',
            'image/x-canon-cr2', 'image/x-nikon-nef', 'image/x-sony-arw', 'image/x-adobe-dng',
            'image/x-panasonic-rw2', 'image/x-olympus-orf', 'image/x-fuji-raf',
        ];
        const rawExts = ['cr2', 'cr3', 'nef', 'arw', 'dng', 'rw2', 'orf', 'raf', 'heic', 'heif', 'avif', 'tiff', 'tif', 'bmp'];
        const fileExt = file.name.toLowerCase().split('.').pop() || '';
        const isKnownImage = validTypes.includes(file.type) || file.type.startsWith('image/');
        const isRawByExt = rawExts.includes(fileExt);
        if (!isKnownImage && !isRawByExt) {
            return NextResponse.json({ error: 'Loại file không hỗ trợ. Hỗ trợ: JPEG, PNG, WebP, GIF, HEIC, HEIF, AVIF, TIFF, BMP, RAW' }, { status: 400 });
        }

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Get existing demo images
        const existingImages: DemoImage[] = Array.isArray(order.demo_images) ? order.demo_images : [];
        const imageIndex = existingImages.length + 1;

        // Get file extension
        const originalExt = getExtension(file.name);

        // Non-web formats: browsers can't display HEIC/HEIF/RAW/TIFF/BMP/AVIF.
        // Watermark converts them to JPEG, so store with .jpg extension.
        const nonWebExts = new Set(['heic', 'heif', 'avif', 'tiff', 'tif', 'bmp', 'cr2', 'cr3', 'nef', 'nrw', 'arw', 'srf', 'sr2', 'dng', 'rw2', 'orf', 'raf', 'pef', 'tga', 'ico']);
        const isNonWeb = nonWebExts.has(originalExt.toLowerCase());
        const ext = isNonWeb ? 'jpg' : originalExt;

        // Generate R2 key using studio naming convention
        // e.g. orders/C494D49D/demo/ORD-C494D49D_DEMO_FULL_V01_01.jpg
        const r2Key = generateStudioR2Key({
            orderCode: orderCode,
            stage: 'DEMO',
            version: 1,
            index: imageIndex,
            extension: ext,
        });

        // ─── Apply Watermark ─────────────────────────────────
        const { addWatermark } = await import('@/lib/watermark');
        const processedBuffer = await addWatermark(buffer);
        // ──────────────────────────────────────────────────────

        // Upload with correct content type (JPEG for converted formats)
        const uploadContentType = isNonWeb ? 'image/jpeg' : file.type;
        await uploadToR2(processedBuffer, r2Key, uploadContentType, {
            orderId,
            orderCode: orderCode,
            type: 'demo',
            index: String(imageIndex),
        });

        // Store persistent proxy URL (not expiring presigned URL)
        const proxyUrl = `/api/files/${r2Key}`;

        // Build new image entry
        const newImage: DemoImage = {
            url: proxyUrl,
            label,
            uploaded_at: new Date().toISOString(),
        };

        // Append to demo_images array
        const updatedImages = [...existingImages, newImage];

        // Update order: set demo_images (all)
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                demo_images: updatedImages,
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('[DemoUpload] Update failed:', updateError);
            return NextResponse.json({ error: 'Failed to update order: ' + updateError.message }, { status: 500 });
        }

        // Invalidate cache
        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');
        revalidatePath('/sys_internal/orders', 'page');

        return NextResponse.json({
            success: true,
            image: newImage,
            total_images: updatedImages.length,
            demo_images: updatedImages,
        });
    } catch (error) {
        console.error('[DemoUpload] Error:', error);
        return NextResponse.json({ error: 'Upload failed: ' + (error as Error).message }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/orders/[id]/demo-image
 * Remove a demo image by index
 */
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
            .select('id, demo_images')
            .eq('id', orderId)
            .maybeSingle();

        if (findError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const images: DemoImage[] = Array.isArray(order.demo_images) ? order.demo_images : [];
        if (imageIndex < 0 || imageIndex >= images.length) {
            return NextResponse.json({ error: 'Invalid image index' }, { status: 400 });
        }

        // Delete from R2 storage first
        const imageToDelete = images[imageIndex];
        if (imageToDelete?.url) {
            try {
                const r2Key = extractR2KeyFromUrl(imageToDelete.url);
                if (r2Key) {
                    await deleteFromR2(r2Key);
                    const { createLogger } = await import('@/lib/logger');
                    createLogger('demo-image').info('Deleted from R2', { r2Key });
                }
            } catch (r2Error) {
                // Log but don't block — DB cleanup is more important
                console.error('[DemoDelete] R2 delete failed (non-blocking):', r2Error);
            }
        }

        // Remove image at index from DB
        const updatedImages = images.filter((_, i) => i !== imageIndex);

        const { error: updateError } = await supabase
            .from('orders')
            .update({
                demo_images: updatedImages,
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        if (updateError) {
            return NextResponse.json({ error: 'Update failed: ' + updateError.message }, { status: 500 });
        }

        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');

        return NextResponse.json({
            success: true,
            demo_images: updatedImages,
            total_images: updatedImages.length,
        });
    } catch (error) {
        return NextResponse.json({ error: 'Delete failed: ' + (error as Error).message }, { status: 500 });
    }
}
