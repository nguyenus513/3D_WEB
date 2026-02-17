import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getR2SignedUrl } from '@/lib/storage/r2';
import { getDirectUrl } from '@/lib/google-drive-oauth';

/**
 * GET /api/admin/orders/[id]/files/[fileId]/download
 * 
 * Admin-only endpoint to download a file from an order.
 * Bypasses user ownership check — only requires admin auth.
 * Returns JSON with signed download URL and file metadata.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; fileId: string }> }
) {
    try {
        const { authorized, response: authResponse } = await requireAdmin(request);
        if (!authorized) return authResponse!;

        const { id: orderId, fileId } = await params;

        if (!orderId || !fileId) {
            return NextResponse.json({ error: 'Missing orderId or fileId' }, { status: 400 });
        }

        const supabase = getAdminSupabase();

        // Fetch file record — must belong to the specified order
        const { data: file, error } = await supabase
            .from('order_files')
            .select('id, file_name, file_key, file_type, file_url, storage_provider, size_bytes')
            .eq('id', fileId)
            .eq('order_id', orderId)
            .single();

        if (error || !file) {
            console.error('[AdminDownload] File not found:', error?.message);
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Generate download URL based on storage provider
        let downloadUrl: string | null = null;

        if (file.storage_provider === 'r2') {
            if (!file.file_key) {
                return NextResponse.json({ error: 'Missing file key in storage' }, { status: 500 });
            }
            // Generate a signed URL valid for 1 hour
            downloadUrl = await getR2SignedUrl(file.file_key, 3600);
        } else if (file.storage_provider === 'drive') {
            // For Drive files, file_key holds driveFileId, file_url holds the direct URL
            downloadUrl = file.file_url || (file.file_key ? getDirectUrl(file.file_key) : null);
        }

        if (!downloadUrl) {
            return NextResponse.json({ error: 'File not available for download' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: {
                url: downloadUrl,
                fileName: file.file_name || 'download',
                fileType: file.file_type,
                sizeBytes: file.size_bytes,
            }
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[AdminDownload] Error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
