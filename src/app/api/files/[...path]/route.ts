/**
 * Secure File Proxy API
 * 
 * All file access must go through this route for security.
 * - Verifies user session
 * - Checks ownership/permissions
 * - Logs access attempts
 * - Streams file from R2
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { downloadFromR2, existsInR2, streamFromR2 } from '@/lib/storage/r2';
import { canAccessFile, logFileAccess } from '@/lib/security/file-access';

// MIME types for common files
const MIME_TYPES: Record<string, string> = {
    // Standard images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    // iOS / modern formats
    'heic': 'image/heic',
    'heif': 'image/heif',
    'avif': 'image/avif',
    // RAW camera formats
    'cr2': 'image/x-canon-cr2',
    'cr3': 'image/x-canon-cr2',
    'nef': 'image/x-nikon-nef',
    'nrw': 'image/x-nikon-nef',
    'arw': 'image/x-sony-arw',
    'srf': 'image/x-sony-arw',
    'sr2': 'image/x-sony-arw',
    'dng': 'image/x-adobe-dng',
    'rw2': 'image/x-panasonic-rw2',
    'orf': 'image/x-olympus-orf',
    'raf': 'image/x-fuji-raf',
    'pef': 'image/tiff',
    // 3D / documents
    'stl': 'application/sla',
    'obj': 'text/plain',
    'pdf': 'application/pdf',
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const startTime = Date.now();
    const { path } = await params;
    const fileKey = path.join('/');

    // Get client info for logging
    const ipAddress = request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    try {
        // Get session
        const session = await auth();
        const userId = session?.user?.id || null;
        const userRole = (session?.user as { role?: string })?.role;

        // Check access permission
        const accessCheck = await canAccessFile(userId, fileKey, userRole);

        if (!accessCheck.allowed) {
            // Log denied access
            await logFileAccess({
                fileKey,
                fileId: accessCheck.fileId,
                userId: userId || undefined,
                action: 'view',
                ipAddress,
                userAgent,
                success: false,
                deniedReason: accessCheck.reason,
            });

            return NextResponse.json(
                { error: 'Access denied', reason: accessCheck.reason },
                { status: 403 }
            );
        }

        // Check if file exists
        const exists = await existsInR2(fileKey);
        if (!exists) {
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        }

        // Download file from R2 (Streaming)
        // const buffer = await downloadFromR2(fileKey); // OLD memory intensive way
        const r2Response = await streamFromR2(fileKey);

        if (!r2Response.Body) {
            return NextResponse.json(
                { error: 'File body empty' },
                { status: 500 }
            );
        }

        // Determine content type
        const ext = fileKey.split('.').pop()?.toLowerCase() || '';
        const contentType = r2Response.ContentType || MIME_TYPES[ext] || 'application/octet-stream';
        const contentLength = r2Response.ContentLength;

        // Log successful access
        await logFileAccess({
            fileKey,
            fileId: accessCheck.fileId,
            userId: userId || undefined,
            action: 'view',
            ipAddress,
            userAgent,
            success: true,
        });

        // Set cache headers based on file type
        const cacheControl = accessCheck.isPublic
            ? 'public, max-age=31536000' // 1 year for public files
            : 'private, max-age=3600';    // 1 hour for private files

        const { createLogger } = await import('@/lib/logger');
        const log = createLogger('file-stream');
        log.info('Streaming file', { fileKey, userId: userId || 'anonymous' });

        // Convert Node stream to Web Stream for NextResponse
        // @ts-ignore - S3 Body is compatible with Web Stream in simpler cases or requires transformation
        const stream = r2Response.Body.transformToWebStream
            ? r2Response.Body.transformToWebStream()
            : r2Response.Body as any;

        return new NextResponse(stream, {
            headers: {
                'Content-Type': contentType,
                ...(contentLength && { 'Content-Length': contentLength.toString() }),
                'Cache-Control': cacheControl,
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error) {
        console.error('[Files] Error serving file:', fileKey, error);

        return NextResponse.json(
            { error: 'Failed to serve file' },
            { status: 500 }
        );
    }
}
