import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-drive-oauth';
import { requireAdmin } from '@/lib/security/admin-guard';

/**
 * GET /api/drive/auth
 * Redirects admin to Google OAuth consent screen
 * 
 * SECURITY: Requires admin authentication
 */
export async function GET(request: NextRequest) {
    try {
        // SECURITY: Admin only
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const authUrl = await getAuthUrl();
        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error('OAuth auth error:', error);
        return NextResponse.json({
            error: 'OAuth not configured'
        }, { status: 500 });
    }
}
