import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { saveTokens } from '@/lib/google-drive-oauth';

/**
 * POST /api/admin/drive/set-token
 * Manually update Google Drive OAuth tokens without UI flow.
 * Useful if you have a refresh token generated externally.
 * 
 * Body: { refreshToken: string, accessToken?: string, expiry?: number }
 */
export async function POST(request: NextRequest) {
    try {
        // Did you mean: requireAdmin?
        // Wait, requireAdmin is not exported from '@/lib/security/admin-guard' in my knowledge?
        // Check finding: src/app/api/drive/auth/route.ts uses it.
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const body = await request.json();
        const { refreshToken, accessToken, expiry } = body;

        if (!refreshToken) {
            return NextResponse.json(
                { error: 'refreshToken is required' },
                { status: 400 }
            );
        }

        // Save tokens
        await saveTokens({
            access_token: accessToken || null, // Optional, can be fetched via refresh
            refresh_token: refreshToken,
            expiry_date: expiry || Date.now() + 3600 * 1000 // Default 1 hour if not provided
        });

        return NextResponse.json({
            success: true,
            message: 'Google Drive tokens updated successfully. Account changed.'
        });
    } catch (error) {
        console.error('Manual token update failed:', error);
        return NextResponse.json(
            { error: 'Failed to update token: ' + (error as Error).message },
            { status: 500 }
        );
    }
}
