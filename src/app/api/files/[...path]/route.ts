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
import { downloadFromR2, existsInR2 } from '@/lib/storage/r2';
import { canAccessFile, logFileAccess } from '@/lib/security/file-access';

// MIME types for common files
const MIME_TYPES: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
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

        // Download file from R2
        const buffer = await downloadFromR2(fileKey);

        // Determine content type
        const ext = fileKey.split('.').pop()?.toLowerCase() || '';
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

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

        console.log(`[Files] Served ${fileKey} to ${userId || 'anonymous'} in ${Date.now() - startTime}ms`);

        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                'Content-Type': contentType,
                'Content-Length': buffer.length.toString(),
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
