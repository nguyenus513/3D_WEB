import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-drive-oauth';

/**
 * GET /api/drive/auth
 * Redirects admin to Google OAuth consent screen
 */
export async function GET() {
    try {
        const authUrl = getAuthUrl();
        return NextResponse.redirect(authUrl);
    } catch (error) {
        return NextResponse.json({
            error: 'OAuth not configured: ' + (error as Error).message
        }, { status: 500 });
    }
}
