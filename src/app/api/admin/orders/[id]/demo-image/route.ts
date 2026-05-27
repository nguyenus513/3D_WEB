/**
 * Admin Demo Image Upload API (Design Versioning)
 * POST /api/admin/orders/[id]/demo-image - Upload image to current or new design version
 * DELETE /api/admin/orders/[id]/demo-image - Remove a design image by ID
 *
 * Uses design_versions + design_images tables for audit trail.
 * Also syncs to orders.demo_images for backward compatibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/security/admin-guard';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { uploadToR2, isR2Configured, deleteFromR2, extractR2KeyFromUrl } from '@/lib/storage/r2';
import { generateStudioR2Key, getExtension } from '@/lib/naming';
import { createNotification } from '@/lib/notifications';
import { trackFileUpload } from '@/lib/security/file-access';
import { sendOrderStatusEmail } from '@/lib/email/orderStatusEmail';

const MAX_IMAGES_PER_VERSION = 10;
const MAX_REVISIONS = 5;

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

        // Find order
        const { data: order, error: findError } = await supabase
            .from('orders')
            .select('id, order_code, user_id, status')
            .eq('id', orderId)
            .maybeSingle();

        if (findError || !order) {
            console.error('[DemoUpload] Order not found:', findError?.message);
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const orderCode = order.order_code || order.id.slice(0, 8).toUpperCase();

        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const label = (formData.get('label') as string) || 'Demo';
        const adminNote = (formData.get('admin_note') as string) || null;
        // If create_new_version=true, always create a new version
        const createNewVersion = formData.get('create_new_version') === 'true';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
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
            return NextResponse.json({ error: 'Loại file không hỗ trợ' }, { status: 400 });
        }

        // Get or create design version
        const { data: latestVersion } = await supabase
            .from('design_versions')
            .select('id, version_number, status')
            .eq('order_id', orderId)
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle();

        let versionId: string;
        let versionNumber: number;

        // Create new version if: no version exists, or explicitly requested, or latest was rejected
        const needNewVersion = !latestVersion || createNewVersion || latestVersion.status === 'rejected';

        if (needNewVersion) {
            versionNumber = (latestVersion?.version_number || 0) + 1;

            // Check max revisions
            if (versionNumber > MAX_REVISIONS) {
                return NextResponse.json({
                    error: `Đã đạt giới hạn ${MAX_REVISIONS} lần chỉnh sửa`
                }, { status: 400 });
            }

            const { data: newVersion, error: createError } = await supabase
                .from('design_versions')
                .insert({
                    order_id: orderId,
                    version_number: versionNumber,
                    status: 'pending_review',
                    admin_note: adminNote,
                })
                .select('id')
                .single();

            if (createError || !newVersion) {
                console.error('[DemoUpload] Create version failed:', createError);
                return NextResponse.json({ error: 'Failed to create version' }, { status: 500 });
            }

            versionId = newVersion.id;
        } else {
            // Append to existing pending_review version
            versionId = latestVersion.id;
            versionNumber = latestVersion.version_number;

            // Check image count for this version
            const { count } = await supabase
                .from('design_images')
                .select('id', { count: 'exact', head: true })
                .eq('version_id', versionId);

            if ((count || 0) >= MAX_IMAGES_PER_VERSION) {
                return NextResponse.json({
                    error: `Tối đa ${MAX_IMAGES_PER_VERSION} ảnh mỗi version`
                }, { status: 400 });
            }
        }

        // Get image count for naming
        const { count: imageCount } = await supabase
            .from('design_images')
            .select('id', { count: 'exact', head: true })
            .eq('version_id', versionId);

        const imageIndex = (imageCount || 0) + 1;

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Handle non-web formats
        const originalExt = getExtension(file.name);
        const nonWebExts = new Set(['heic', 'heif', 'avif', 'tiff', 'tif', 'bmp', 'cr2', 'cr3', 'nef', 'nrw', 'arw', 'srf', 'sr2', 'dng', 'rw2', 'orf', 'raf', 'pef', 'tga', 'ico']);
        const isNonWeb = nonWebExts.has(originalExt.toLowerCase());
        const ext = isNonWeb ? 'jpg' : originalExt;

        // Generate R2 key with version number
        const r2Key = generateStudioR2Key({
            orderCode: orderCode,
            stage: 'DEMO',
            version: versionNumber,
            index: imageIndex,
            extension: ext,
        });

        // Apply watermark
        const { addWatermark } = await import('@/lib/watermark');
        const processedBuffer = await addWatermark(buffer);

        // Upload to R2
        const uploadContentType = isNonWeb ? 'image/jpeg' : file.type;
        await uploadToR2(processedBuffer, r2Key, uploadContentType, {
            orderId,
            orderCode: orderCode,
            type: 'demo',
            version: String(versionNumber),
            index: String(imageIndex),
        });

        await trackFileUpload(r2Key, order.user_id, orderId, {
            fileName: file.name,
            fileType: uploadContentType,
        });

        const proxyUrl = `/api/files/${r2Key}`;

        // Insert design image
        const { data: newImage, error: insertError } = await supabase
            .from('design_images')
            .insert({
                version_id: versionId,
                image_url: proxyUrl,
                label,
                sort_order: imageIndex,
            })
            .select('id, image_url, label, sort_order')
            .single();

        if (insertError) {
            console.error('[DemoUpload] Insert image failed:', insertError);
            return NextResponse.json({ error: 'Failed to save image' }, { status: 500 });
        }

        // Sync to orders.demo_images for backward compatibility
        const { data: allImages } = await supabase
            .from('design_images')
            .select('image_url, label, created_at')
            .eq('version_id', versionId)
            .order('sort_order', { ascending: true });

        const demoImagesSync = (allImages || []).map((img: any) => ({
            url: img.image_url,
            label: img.label || 'Demo',
            uploaded_at: img.created_at,
        }));

        const reviewAt = new Date().toISOString();
        const demoImageUrl = demoImagesSync[demoImagesSync.length - 1]?.url || proxyUrl;

        const { error: orderUpdateError } = await supabase
            .from('orders')
            .update({
                status: 'review',
                review_at: reviewAt,
                demo_images: demoImagesSync,
                demo_image_url: demoImageUrl,
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        if (orderUpdateError) {
            console.error('[DemoUpload] Order sync failed:', orderUpdateError);
            return NextResponse.json({ error: 'Failed to update order review status: ' + orderUpdateError.message }, { status: 500 });
        }

        // Notify order owner
        if (order.user_id) {
            await createNotification({
                userId: order.user_id,
                title: 'Thiết kế mới đã sẵn sàng',
                message: `Đơn hàng #${orderCode} - Vui lòng xem và duyệt thiết kế`,
                type: 'design_uploaded',
                refId: orderId,
                refType: 'order',
            });
        }

        await sendOrderStatusEmail({
            orderId,
            oldStatus: order.status,
            newStatus: 'review',
        });

        // Invalidate cache
        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');
        revalidatePath('/sys_internal/orders', 'page');
        revalidatePath(`/account/orders/${orderId}`, 'page');

        return NextResponse.json({
            success: true,
            image: newImage,
            new_status: 'review',
            demo_image_url: demoImageUrl,
            review_at: reviewAt,
            version: {
                id: versionId,
                version_number: versionNumber,
            },
            demo_images: demoImagesSync,
        });
    } catch (error) {
        console.error('[DemoUpload] Error:', error);
        return NextResponse.json({ error: 'Upload failed: ' + (error as Error).message }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/orders/[id]/demo-image
 * Remove a design image by image ID
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

        // Accept either image_id (new) or index (legacy)
        const imageId = body.image_id;
        const imageIndex = body.index ?? -1;

        const supabase = getAdminSupabase();

        let imageToDelete: { id: string; image_url: string; version_id: string } | null = null;

        if (imageId) {
            // New: delete by design_images.id
            const { data } = await supabase
                .from('design_images')
                .select('id, image_url, version_id')
                .eq('id', imageId)
                .maybeSingle();
            imageToDelete = data;
        } else if (imageIndex >= 0) {
            // Legacy: delete by index from orders.demo_images
            const { data: order } = await supabase
                .from('orders')
                .select('demo_images')
                .eq('id', orderId)
                .maybeSingle();

            const images = Array.isArray(order?.demo_images) ? order.demo_images : [];
            if (imageIndex < images.length) {
                const imgUrl = images[imageIndex]?.url;
                // Try to find matching design_image
                const { data } = await supabase
                    .from('design_images')
                    .select('id, image_url, version_id')
                    .eq('image_url', imgUrl)
                    .maybeSingle();
                imageToDelete = data;

                // Even if not found in design_images, remove from orders.demo_images
                if (!imageToDelete) {
                    // Legacy cleanup: just remove from JSONB array
                    const updatedImages = images.filter((_: unknown, i: number) => i !== imageIndex);
                    await supabase
                        .from('orders')
                        .update({ demo_images: updatedImages, updated_at: new Date().toISOString() })
                        .eq('id', orderId);

                    // Try R2 delete
                    if (imgUrl) {
                        try {
                            const r2Key = extractR2KeyFromUrl(imgUrl);
                            if (r2Key) await deleteFromR2(r2Key);
                        } catch { /* non-blocking */ }
                    }

                    revalidatePath(`/sys_internal/orders/${orderId}`, 'page');
                    return NextResponse.json({ success: true, demo_images: updatedImages });
                }
            }
        }

        if (!imageToDelete) {
            return NextResponse.json({ error: 'Image not found' }, { status: 404 });
        }

        // Delete from R2
        try {
            const r2Key = extractR2KeyFromUrl(imageToDelete.image_url);
            if (r2Key) await deleteFromR2(r2Key);
        } catch (r2Error) {
            console.error('[DemoDelete] R2 delete failed (non-blocking):', r2Error);
        }

        // Delete from design_images
        await supabase
            .from('design_images')
            .delete()
            .eq('id', imageToDelete.id);

        // Sync orders.demo_images
        const { data: remainingImages } = await supabase
            .from('design_images')
            .select('image_url, label, created_at')
            .eq('version_id', imageToDelete.version_id)
            .order('sort_order', { ascending: true });

        const demoImagesSync = (remainingImages || []).map((img: any) => ({
            url: img.image_url,
            label: img.label || 'Demo',
            uploaded_at: img.created_at,
        }));

        await supabase
            .from('orders')
            .update({ demo_images: demoImagesSync, updated_at: new Date().toISOString() })
            .eq('id', orderId);

        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');

        return NextResponse.json({
            success: true,
            demo_images: demoImagesSync,
        });
    } catch (error) {
        return NextResponse.json({ error: 'Delete failed: ' + (error as Error).message }, { status: 500 });
    }
}

