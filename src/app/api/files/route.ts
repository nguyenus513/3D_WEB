import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { canAccessFileById, logFileAccess } from '@/lib/security/file-access';
import { getR2SignedUrl } from '@/lib/storage/r2';
import { getDirectUrl } from '@/lib/google-drive-oauth';

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
        .from('order_files')
        .select('id, file_key, storage_provider, drive_url, drive_file_id, is_public')
        .eq('id', id)
        .single();

    if (!file) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    let targetUrl: string | null = null;
    if (file.storage_provider === 'r2') {
        if (!file.file_key) {
            return NextResponse.json({ error: 'Missing file key' }, { status: 500 });
        }
        targetUrl = await getR2SignedUrl(file.file_key, 3600);
    } else if (file.storage_provider === 'drive') {
        targetUrl = file.drive_url || (file.drive_file_id ? getDirectUrl(file.drive_file_id) : null);
    }

    if (!targetUrl) {
        return NextResponse.json({ error: 'File not available' }, { status: 404 });
    }

    await logFileAccess({
        fileKey: file.file_key || file.drive_file_id || id,
        fileId: file.id,
        userId: userId || undefined,
        action: 'view',
        ipAddress,
        userAgent,
        success: true,
    });

    return NextResponse.redirect(targetUrl);
}
