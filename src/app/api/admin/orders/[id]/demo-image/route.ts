/**
 * Admin Demo Image Upload API
 * POST /api/admin/orders/[id]/demo-image - Upload demo/preview image for customer review
 * 
 * Storage: Cloudflare R2 (fast serving)
 * Uses DIRECT PostgreSQL to bypass Supabase REST API cache issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache'; // Invalidate Next.js cache
import { requireAdmin } from '@/lib/security/admin-guard';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { uploadToR2, generateReviewR2Key, isR2Configured } from '@/lib/storage/r2';
import { dbRequest } from '@/lib/db-direct';

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
        let targetTable = '';
        let orderCode = '';

        // 1. Try orders table
        const { data: order } = await supabase
            .from('orders')
            .select('id, order_code, user_id')
            .eq('id', orderId)
            .maybeSingle();

        if (order) {
            targetTable = 'orders';
            orderCode = order.order_code;
        } else {
            // 2. Try custom_orders table
            const { data: customOrder } = await supabase
                .from('custom_orders')
                .select('id, order_number, user_id')
                .eq('id', orderId)
                .maybeSingle();

            if (customOrder) {
                targetTable = 'custom_orders';
                orderCode = customOrder.order_number;
            } else {
                // 3. Try print_orders table
                const { data: printOrder } = await supabase
                    .from('print_orders')
                    .select('id, order_number, user_id')
                    .eq('id', orderId)
                    .maybeSingle();

                if (printOrder) {
                    targetTable = 'print_orders';
                    orderCode = printOrder.order_number;
                }
            }
        }

        if (!targetTable) {
            return NextResponse.json({ error: 'Order not found in any table' }, { status: 404 });
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

        // ===== Update status: Try Direct PostgreSQL first, fallback to Supabase REST =====
        let updateSuccess = false;

        // Try direct PostgreSQL
        try {
            const updateQuery = `
                UPDATE ${targetTable} 
                SET status = $1, 
                    demo_image_url = $2,
                    updated_at = NOW()
                WHERE id = $3
            `;
            const result = await dbRequest.query(updateQuery, ['review', demoImageUrl, orderId]);
            console.log('[DemoUpload] Direct PostgreSQL update:', result.rowCount, 'rows affected');
            updateSuccess = (result.rowCount || 0) > 0;
        } catch (dbError) {
            console.warn('[DemoUpload] Direct PostgreSQL failed, trying Supabase REST:', (dbError as Error).message);
        }

        // Fallback: Use Supabase REST API
        if (!updateSuccess) {
            const { error: updateError } = await supabase
                .from(targetTable)
                .update({
                    status: 'review',
                    demo_image_url: demoImageUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            if (updateError) {
                console.error('[DemoUpload] Supabase REST also failed:', updateError);
            } else {
                console.log('[DemoUpload] Supabase REST update succeeded');
                updateSuccess = true;
            }
        }

        // === CRITICAL: Invalidate Next.js cache to ensure fresh data on reload ===
        if (updateSuccess) {
            console.log('[DemoUpload] Invalidating cache for:', `/sys_internal/orders/${orderId}`);
            revalidatePath(`/sys_internal/orders/${orderId}`, 'page');
            revalidatePath('/sys_internal/orders', 'page');
        }

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

