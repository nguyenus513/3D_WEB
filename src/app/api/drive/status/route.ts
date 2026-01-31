import { NextResponse } from 'next/server';
import { isDriveConnected, disconnectDrive, getDriveStatus } from '@/lib/google-drive-oauth';

/**
 * GET /api/drive/status
 * Check if Google Drive is connected
 */
export async function GET() {
    try {
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
export async function DELETE() {
    try {
        await disconnectDrive();
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
