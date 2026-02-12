import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { downloadFromR2, isR2Configured, extractR2KeyFromUrl, isR2Url } from '@/lib/storage/r2';
import { uploadFile, isDriveConnected, ensureFolder } from '@/lib/google-drive-oauth';
import { generateStudioName, getExtension, Stage, DriveFolderPrefix, type StageType } from '@/lib/naming';

// Supabase admin client
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DemoImage {
    url: string;
    label: string;
    uploaded_at: string;
}

/**
 * Collect archivable files from multiple sources:
 * 1. order_files table (legacy)
 * 2. orders.demo_images JSON array
 * 3. orders.finished_images JSON array
 */
function collectArchivableFiles(
    orderFiles: { file_key: string; file_name: string; category?: string }[],
    demoImages: DemoImage[],
    finishedImages: DemoImage[]
): { r2Key: string; name: string; stage: StageType }[] {
    const files: { r2Key: string; name: string; stage: StageType }[] = [];

    // 1. From order_files table
    for (const f of orderFiles) {
        if (f.file_key) {
            files.push({
                r2Key: f.file_key,
                name: f.file_name || f.file_key.split('/').pop() || 'file',
                stage: detectStage(f.file_key, f.category),
            });
        }
    }

    // 2. From demo_images JSON
    for (const img of demoImages) {
        if (img.url && isR2Url(img.url)) {
            const key = extractR2KeyFromUrl(img.url);
            if (key) {
                files.push({
                    r2Key: key,
                    name: key.split('/').pop() || img.label || 'demo',
                    stage: Stage.DEMO,
                });
            }
        }
    }

    // 3. From finished_images JSON
    for (const img of finishedImages) {
        if (img.url && isR2Url(img.url)) {
            const key = extractR2KeyFromUrl(img.url);
            if (key) {
                files.push({
                    r2Key: key,
                    name: key.split('/').pop() || img.label || 'final',
                    stage: Stage.FINAL,
                });
            }
        }
    }

    return files;
}

/** Detect stage from R2 key path */
function detectStage(r2Key: string, category?: string): StageType {
    const keyLower = r2Key.toLowerCase();
    if (keyLower.includes('/demo/') || category === 'demo') return Stage.DEMO;
    if (keyLower.includes('/final/') || keyLower.includes('/finished/') || category === 'finished') return Stage.FINAL;
    if (keyLower.includes('/source/') || category === 'reference') return Stage.SOURCE;
    if (keyLower.includes('/model/') || category === 'models') return Stage.MODEL;
    if (keyLower.includes('/stl/') || category === 'stl') return Stage.STL;
    if (keyLower.includes('/qc/') || category === 'qc') return Stage.QC;
    return Stage.SOURCE;
}

/** Determine MIME type from extension */
function getMimeType(ext: string): string {
    if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'stl') return 'application/sla';
    if (ext === 'obj') return 'text/plain';
    return 'application/octet-stream';
}

/**
 * POST /api/admin/orders/[id]/archive
 *
 * Archives order files from R2 to Google Drive.
 * Sources: order_files table + orders.demo_images + orders.finished_images
 * After success: sets orders.archived_at
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // ─── Auth ──────────────────────────────────────────────
        const session = await auth();
        const userRole = (session?.user as { role?: string })?.role;
        if (!session?.user || userRole !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: orderId } = await params;
        if (!orderId) {
            return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
        }

        // ─── Pre-checks ───────────────────────────────────────
        if (!isR2Configured()) {
            return NextResponse.json({ error: 'R2 not configured' }, { status: 400 });
        }

        const driveConnected = await isDriveConnected();
        if (!driveConnected) {
            return NextResponse.json({
                error: 'Google Drive not connected. Please connect Drive in Admin Settings.'
            }, { status: 400 });
        }

        // ─── Get order with image arrays ─────────────────────
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, order_code, status, demo_images, finished_images, archived_at')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Prevent re-archive
        if (order.archived_at) {
            return NextResponse.json({
                success: true,
                message: 'Order already archived',
                archived: 0,
                total: 0,
            });
        }

        // ─── Get order_files (legacy) ────────────────────────
        const { data: orderFiles } = await supabaseAdmin
            .from('order_files')
            .select('file_key, file_name, category')
            .eq('order_id', orderId);

        // ─── Collect all archivable files ────────────────────
        const demoImages: DemoImage[] = Array.isArray(order.demo_images) ? order.demo_images : [];
        const finishedImages: DemoImage[] = Array.isArray(order.finished_images) ? order.finished_images : [];

        const allFiles = collectArchivableFiles(
            orderFiles || [],
            demoImages,
            finishedImages
        );

        if (allFiles.length === 0) {
            return NextResponse.json({
                message: 'No files to archive',
                archived: 0,
                total: 0,
            });
        }

        // ─── Create Drive folder: ORD-{CODE} ────────────────
        const { createLogger } = await import('@/lib/logger');
        const log = createLogger('archive');

        const archiveRootId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';
        const orderFolderName = `ORD-${order.order_code}`;
        let orderFolderId: string;

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

        // ─── Process each file ───────────────────────────────
        let archivedCount = 0;
        const errors: string[] = [];
        const stageCounters: Record<string, number> = {};

        for (const file of allFiles) {
            try {
                // 1. Download from R2
                const fileBuffer = await downloadFromR2(file.r2Key);

                // 2. Create stage subfolder
                const stageFolder = DriveFolderPrefix[file.stage] || file.stage;
                const stageFolderId = await ensureFolder(orderFolderId, stageFolder);

                // 3. Generate studio filename
                const ext = getExtension(file.name);
                const counterKey = file.stage;
                stageCounters[counterKey] = (stageCounters[counterKey] || 0) + 1;

                const studioFileName = generateStudioName({
                    orderCode: order.order_code,
                    stage: file.stage,
                    version: 1,
                    index: stageCounters[counterKey],
                    extension: ext,
                });

                // 4. Upload to Drive and VERIFY fileId
                const result = await uploadFile(
                    fileBuffer,
                    studioFileName,
                    getMimeType(ext),
                    stageFolderId
                );

                if (!result?.fileId) {
                    throw new Error('Drive upload returned no fileId');
                }

                log.info('Archived file', {
                    from: file.name,
                    to: `${stageFolder}/${studioFileName}`,
                    driveFileId: result.fileId,
                });

                archivedCount++;
            } catch (fileError) {
                const errorMsg = `Failed to archive ${file.name}: ${(fileError as Error).message}`;
                log.warn(errorMsg);
                errors.push(errorMsg);
            }
        }

        // ─── Update DB: set archived_at if any file succeeded ─
        if (archivedCount > 0) {
            const { error: updateError } = await supabaseAdmin
                .from('orders')
                .update({ archived_at: new Date().toISOString() })
                .eq('id', orderId);

            if (updateError) {
                log.warn('Failed to set archived_at', { error: updateError.message });
            }
        }

        return NextResponse.json({
            success: archivedCount > 0,
            message: `Archived ${archivedCount}/${allFiles.length} files to Google Drive`,
            archived: archivedCount,
            total: allFiles.length,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error('Archive error:', error);
        return NextResponse.json({
            error: 'Archive failed: ' + (error as Error).message
        }, { status: 500 });
    }
}
