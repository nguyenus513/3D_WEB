import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { downloadFromR2, deleteFromR2, isR2Configured } from '@/lib/storage/r2';
import { uploadFile, isDriveConnected, ensureFolder } from '@/lib/google-drive-oauth';
import { generateStudioName, getExtension, Stage, DriveFolderPrefix, type StageType } from '@/lib/naming';

// Supabase admin client
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/orders/[id]/archive
 * 
 * Archives order files from R2 to Google Drive when order is marked as delivered.
 * - Downloads files from R2
 * - Uploads to Google Drive with same folder structure
 * - Deletes from R2 after successful transfer
 * 
 * SECURITY: Admin only
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verify admin auth
        const session = await auth();
        const userRole = (session?.user as { role?: string })?.role;
        if (!session?.user || userRole !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: orderId } = await params;

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
        }

        // Check if R2 is configured
        if (!isR2Configured()) {
            return NextResponse.json({
                error: 'R2 not configured, nothing to archive'
            }, { status: 400 });
        }

        // Check if Drive is connected
        const driveConnected = await isDriveConnected();
        if (!driveConnected) {
            return NextResponse.json({
                error: 'Google Drive not connected. Please connect Drive in Admin Settings.'
            }, { status: 400 });
        }

        // Get order details
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, order_code, status')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({
                error: 'Order not found'
            }, { status: 404 });
        }

        // Query order_files separately (embedded join can fail silently)
        const { data: orderFiles, error: filesError } = await supabaseAdmin
            .from('order_files')
            .select('*')
            .eq('order_id', orderId);

        if (filesError) {
            console.error('[Archive] Failed to fetch order_files:', filesError.message);
        }

        const files = orderFiles || [];

        if (files.length === 0) {
            return NextResponse.json({
                message: 'No files to archive',
                archived: 0
            });
        }

        // Create studio folder structure in Drive
        // Root: GOOGLE_DRIVE_FOLDER_ID / ORD-{CODE}
        const archiveRootId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';
        const orderFolderName = `ORD-${order.order_code}`;
        let orderFolderId: string;

        const { createLogger } = await import('@/lib/logger');
        const log = createLogger('archive');

        try {
            orderFolderId = await ensureFolder(archiveRootId, orderFolderName);
            log.info('Using Drive folder', { folderId: orderFolderId, folderName: orderFolderName });
        } catch (folderError) {
            log.error('Failed to create Drive folder', folderError);
            return NextResponse.json({
                error: 'Failed to create folder in Google Drive.',
                hint: 'Admin must login with Google to enable Drive access.'
            }, { status: 500 });
        }

        let archivedCount = 0;
        const errors: string[] = [];

        // Determine stage from R2 key path
        function detectStage(r2Key: string, category?: string): StageType {
            const keyLower = r2Key.toLowerCase();
            if (keyLower.includes('/demo/') || category === 'demo') return Stage.DEMO;
            if (keyLower.includes('/final/') || keyLower.includes('/finished/') || category === 'finished') return Stage.FINAL;
            if (keyLower.includes('/source/') || category === 'reference') return Stage.SOURCE;
            if (keyLower.includes('/model/') || category === 'models') return Stage.MODEL;
            if (keyLower.includes('/stl/') || category === 'stl') return Stage.STL;
            if (keyLower.includes('/qc/') || category === 'qc') return Stage.QC;
            return Stage.SOURCE; // Default
        }

        // Group files by stage for proper subfolder creation
        const stageCounters: Record<string, number> = {};

        // Process each file
        for (const fileRecord of files) {
            const r2Key = fileRecord.file_key;
            const originalName = fileRecord.file_name || r2Key.split('/').pop() || 'file';
            const stage = detectStage(r2Key, fileRecord.category);

            try {
                // Download from R2
                const fileBuffer = await downloadFromR2(r2Key);

                // Determine content type
                const ext = getExtension(originalName);
                let contentType = 'application/octet-stream';
                if (['jpg', 'jpeg'].includes(ext)) contentType = 'image/jpeg';
                else if (ext === 'png') contentType = 'image/png';
                else if (ext === 'webp') contentType = 'image/webp';
                else if (ext === 'stl') contentType = 'application/sla';
                else if (ext === 'obj') contentType = 'text/plain';

                // Create stage subfolder: ORD-{CODE}/{XX_STAGE}/
                const stageFolder = DriveFolderPrefix[stage] || stage;
                const stageFolderId = await ensureFolder(orderFolderId, stageFolder);

                // Generate studio-compliant filename
                const counterKey = stage;
                stageCounters[counterKey] = (stageCounters[counterKey] || 0) + 1;

                const studioFileName = generateStudioName({
                    orderCode: order.order_code,
                    stage,
                    version: 1,
                    index: stageCounters[counterKey],
                    extension: ext,
                });

                // Upload to Google Drive with studio name
                await uploadFile(
                    fileBuffer,
                    studioFileName,
                    contentType,
                    stageFolderId
                );

                log.info('Archived file', { from: originalName, to: `${stageFolder}/${studioFileName}` });

                // Delete from R2
                await deleteFromR2(r2Key);

                archivedCount++;
            } catch (fileError) {
                const errorMsg = `Failed to archive ${originalName}: ${(fileError as Error).message}`;
                console.error(errorMsg);
                errors.push(errorMsg);
            }
        }

        // Update order to mark as archived (best-effort, don't fail if columns missing)
        try {
            await supabaseAdmin
                .from('orders')
                .update({
                    admin_notes: (order as any).admin_notes
                        ? `${(order as any).admin_notes}\n[Archived to Drive: ${archivedCount} files]`
                        : `[Archived to Drive: ${archivedCount} files]`
                })
                .eq('id', orderId);
        } catch (updateErr) {
            console.warn('[Archive] Failed to update admin_notes after archive:', (updateErr as Error).message);
        }

        return NextResponse.json({
            success: true,
            message: `Archived ${archivedCount}/${files.length} files to Google Drive`,
            archived: archivedCount,
            total: files.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Archive error:', error);
        return NextResponse.json({
            error: 'Archive failed: ' + (error as Error).message
        }, { status: 500 });
    }
}
