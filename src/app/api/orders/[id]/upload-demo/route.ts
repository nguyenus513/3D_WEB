/**
 * Admin API: Upload Demo (Simple)
 * POST /api/orders/[id]/upload-demo
 * Changes status: designing → review
 *
 * Simple URL-based upload (no file). Creates a design version.
 * For file uploads, use /api/admin/orders/[id]/demo-image instead.
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
    const log = createLogger('upload-demo');
    log.info('Uploading demo', { orderId });

    try {
        const body = await request.json();
        const { demo_image_url, admin_note } = body;

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

        if (!['designing', 'review', 'revising'].includes(order.status)) {
            return NextResponse.json({
                error: `Cannot upload demo. Current status: ${order.status}`
            }, { status: 400 });
        }

        // Get latest version
        const { data: latestVersion } = await supabase
            .from('design_versions')
            .select('id, version_number, status')
            .eq('order_id', orderId)
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle();

        const needNewVersion = !latestVersion || latestVersion.status === 'rejected';
        const versionNumber = needNewVersion
            ? (latestVersion?.version_number || 0) + 1
            : latestVersion.version_number;

        let versionId: string;

        if (needNewVersion) {
            const { data: newVersion, error: createError } = await supabase
                .from('design_versions')
                .insert({
                    order_id: orderId,
                    version_number: versionNumber,
                    status: 'pending_review',
                    admin_note: admin_note || null,
                })
                .select('id')
                .single();

            if (createError || !newVersion) {
                return NextResponse.json({ error: 'Failed to create version' }, { status: 500 });
            }
            versionId = newVersion.id;
        } else {
            versionId = latestVersion.id;
        }

        // Insert image
        const { count: imageCount } = await supabase
            .from('design_images')
            .select('id', { count: 'exact', head: true })
            .eq('version_id', versionId);

        await supabase
            .from('design_images')
            .insert({
                version_id: versionId,
                image_url: demo_image_url,
                label: `Demo V${versionNumber}`,
                sort_order: (imageCount || 0) + 1,
            });

        // Sync to orders.demo_images for backward compat
        const { data: allImages } = await supabase
            .from('design_images')
            .select('image_url, label, created_at')
            .eq('version_id', versionId)
            .order('sort_order', { ascending: true });

        const demoImagesSync = (allImages || []).map(img => ({
            url: img.image_url,
            label: img.label || 'Demo',
            uploaded_at: img.created_at,
        }));

        // Update order
        await supabase
            .from('orders')
            .update({
                status: 'review',
                demo_images: demoImagesSync,
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        // Revalidate cache
        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');
        revalidatePath('/sys_internal/orders', 'page');
        revalidatePath(`/account/orders/${orderId}`, 'page');
        revalidatePath('/account/orders', 'page');

        return NextResponse.json({
            success: true,
            message: 'Demo uploaded, waiting for user approval',
            new_status: 'review',
            version_number: versionNumber,
        });
    } catch (error) {
        console.error('[UploadDemo] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
