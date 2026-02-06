import { NextRequest, NextResponse } from 'next/server';
import { isDriveConnected, disconnectDrive, getDriveStatus } from '@/lib/google-drive-oauth';
import { requireAdmin } from '@/lib/security/admin-guard';
import { requireCsrf } from '@/lib/security/csrf';

/**
 * GET /api/drive/status
 * Check if Google Drive is connected
 */
export async function GET(request: NextRequest) {
    try {
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response!;

        const status = await getDriveStatus();
        return NextResponse.json(status);
    } catch (error) {
        return NextResponse.json({ connected: false, error: (error as Error).message });
    }
}

/**
 * DELETE /api/drive/status
 * Disconnect Google Drive
 */
export async function DELETE(request: NextRequest) {
    try {
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response!;

        const csrf = await requireCsrf(request);
        if (!csrf.valid) {
            return csrf.error!;
        }

        await disconnectDrive();
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
