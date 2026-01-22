import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode, saveTokens } from '@/lib/google-drive-oauth';

/**
 * GET /api/drive/callback
 * Handles OAuth callback from Google
 * Saves tokens to Supabase and redirects to admin settings
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Handle errors from Google
    if (error) {
        return NextResponse.redirect(
            new URL('/admin/settings?drive_error=' + encodeURIComponent(error), request.url)
        );
    }

    // No code received
    if (!code) {
        return NextResponse.redirect(
            new URL('/admin/settings?drive_error=no_code', request.url)
        );
    }

    try {
        // Exchange code for tokens
        const tokens = await getTokensFromCode(code);

        // Save tokens to Supabase
        await saveTokens({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: tokens.expiry_date,
        });

        // Redirect to admin settings with success message
        return NextResponse.redirect(
            new URL('/admin/settings?drive_connected=true', request.url)
        );
    } catch (err) {
        console.error('OAuth callback error:', err);
        return NextResponse.redirect(
            new URL('/admin/settings?drive_error=' + encodeURIComponent((err as Error).message), request.url)
        );
    }
}
