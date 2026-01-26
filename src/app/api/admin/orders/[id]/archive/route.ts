import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { downloadFromR2, deleteFromR2, isR2Configured } from '@/lib/storage/r2';
import { uploadFile, isDriveConnected, ensureFolder } from '@/lib/google-drive-oauth';

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
            .select('id, order_code, status, order_files(*)')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({
                error: 'Order not found'
            }, { status: 404 });
        }

        // Get list of files from order_files table
        const orderFiles = order.order_files || [];

        if (orderFiles.length === 0) {
            return NextResponse.json({
                message: 'No files to archive',
                archived: 0
            });
        }

        // Create folder in Drive for this order
        const orderFolderName = order.order_code;
        let orderFolderId: string;

        try {
            // Ensure parent "Orders" folder exists
            const ordersFolderId = await ensureFolder('Orders', 'root');
            // Create order-specific folder
            orderFolderId = await ensureFolder(orderFolderName, ordersFolderId);
        } catch (folderError) {
            console.error('Failed to create Drive folder:', folderError);
            return NextResponse.json({
                error: 'Failed to create folder in Google Drive'
            }, { status: 500 });
        }

        let archivedCount = 0;
        const errors: string[] = [];

        // Process each file
        for (const fileRecord of orderFiles) {
            const r2Key = fileRecord.file_id; // file_id contains the R2 key
            const fileName = fileRecord.file_name || r2Key.split('/').pop() || 'file';

            try {
                // Download from R2
                const fileBuffer = await downloadFromR2(r2Key);

                // Determine content type
                const ext = fileName.split('.').pop()?.toLowerCase() || '';
                let contentType = 'application/octet-stream';
                if (['jpg', 'jpeg'].includes(ext)) contentType = 'image/jpeg';
                else if (ext === 'png') contentType = 'image/png';
                else if (ext === 'webp') contentType = 'image/webp';
                else if (ext === 'stl') contentType = 'application/sla';
                else if (ext === 'obj') contentType = 'text/plain';

                // Upload to Google Drive
                await uploadFile(
                    fileBuffer,
                    fileName,
                    contentType,
                    orderFolderId
                );

                // Delete from R2
                await deleteFromR2(r2Key);

                archivedCount++;
            } catch (fileError) {
                const errorMsg = `Failed to archive ${fileName}: ${(fileError as Error).message}`;
                console.error(errorMsg);
                errors.push(errorMsg);
            }
        }

        // Update order to mark as archived
        await supabaseAdmin
            .from('orders')
            .update({
                archived_at: new Date().toISOString(),
                admin_note: (order as any).admin_note
                    ? `${(order as any).admin_note}\n[Archived to Drive: ${archivedCount} files]`
                    : `[Archived to Drive: ${archivedCount} files]`
            })
            .eq('id', orderId);

        return NextResponse.json({
            success: true,
            message: `Archived ${archivedCount}/${orderFiles.length} files to Google Drive`,
            archived: archivedCount,
            total: orderFiles.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Archive error:', error);
        return NextResponse.json({
            error: 'Archive failed: ' + (error as Error).message
        }, { status: 500 });
    }
}
