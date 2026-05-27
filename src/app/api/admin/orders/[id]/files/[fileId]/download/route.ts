import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getR2SignedUrl } from '@/lib/storage/r2';
import { getDirectUrl } from '@/lib/google-drive-oauth';

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
        const { data: link } = await supabase
            .from('file_links')
            .select('file_id')
            .eq('file_id', fileId)
            .eq('ref_type', 'order')
            .eq('ref_id', orderId)
            .maybeSingle();

        if (!link) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const { data: file, error } = await supabase
            .from('files')
            .select('id, file_name, original_filename, file_key, object_key, file_type, mime_type, file_url, storage_provider, provider, size_bytes')
            .eq('id', fileId)
            .maybeSingle();

        if (error || !file) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const storageProvider = file.storage_provider || file.provider || 'r2';
        const objectKey = file.object_key || file.file_key || (file.file_url?.startsWith('/api/files/') ? file.file_url.replace('/api/files/', '') : null);
        let downloadUrl: string | null = null;

        if (storageProvider === 'r2') {
            if (!objectKey) return NextResponse.json({ error: 'Missing file key in storage' }, { status: 500 });
            downloadUrl = await getR2SignedUrl(objectKey, 3600);
        } else if (storageProvider === 'drive') {
            downloadUrl = file.file_url || (file.file_key ? getDirectUrl(file.file_key) : null);
        }

        if (!downloadUrl) {
            return NextResponse.json({ error: 'File not available for download' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: {
                url: downloadUrl,
                fileName: file.file_name || file.original_filename || 'download',
                fileType: file.file_type || file.mime_type,
                sizeBytes: file.size_bytes,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[AdminDownload] Error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

