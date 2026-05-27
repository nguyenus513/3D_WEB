import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { canAccessFileById, logFileAccess } from '@/lib/security/file-access';
import { getR2SignedUrl } from '@/lib/storage/r2';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'File id is required' }, { status: 400 });
    }

    const session = await auth();
    const userId = session?.user?.id || null;
    const userRole = (session?.user as { role?: string } | undefined)?.role;

    const ipAddress = request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const access = await canAccessFileById(userId, id, userRole);
    if (!access.allowed) {
        await logFileAccess({
            fileKey: id,
            fileId: access.fileId,
            userId: userId || undefined,
            action: 'view',
            ipAddress,
            userAgent,
            success: false,
            deniedReason: access.reason,
        });

        return NextResponse.json({ error: 'Access denied', reason: access.reason }, { status: 403 });
    }

    const supabase = getAdminSupabase();
    const { data: file } = await supabase
        .from('files')
        .select('id, file_url, file_key, object_key, storage_provider, provider, is_public')
        .eq('id', id)
        .single();

    if (!file) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    let targetUrl: string | null = null;
    const storageProvider = file.storage_provider || file.provider || 'r2';
    const objectKey = file.object_key || file.file_key || (file.file_url?.startsWith('/api/files/') ? file.file_url.replace('/api/files/', '') : null);
    if (storageProvider === 'r2') {
        if (!objectKey) {
            return NextResponse.json({ error: 'Missing file key' }, { status: 500 });
        }
        targetUrl = await getR2SignedUrl(objectKey, 3600);
    } else if (file.storage_provider === 'drive') {
        targetUrl = file.file_url || null;
    }

    if (!targetUrl) {
        return NextResponse.json({ error: 'File not available' }, { status: 404 });
    }

    await logFileAccess({
        fileKey: objectKey || file.file_url || id,
        fileId: file.id,
        userId: userId || undefined,
        action: 'view',
        ipAddress,
        userAgent,
        success: true,
    });

    return NextResponse.redirect(targetUrl);
}
