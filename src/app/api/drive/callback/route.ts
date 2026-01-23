import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode, saveTokens, validateOAuthState } from '@/lib/google-drive-oauth';
import { requireAdmin } from '@/lib/security/admin-guard';

/**
 * GET /api/drive/callback
 * Handles OAuth callback from Google
 * Saves tokens to Supabase and redirects to admin settings
 * 
 * SECURITY:
 * - Requires admin authentication
 * - Validates state parameter (CSRF protection)
 */
export async function GET(request: NextRequest) {
    // SECURITY: Require admin authentication
    const { authorized } = await requireAdmin(request);
    if (!authorized) {
        return NextResponse.redirect(
            new URL('/login?error=admin_required', request.url)
        );
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    // SECURITY: Validate state parameter (CSRF protection)
    if (!state || !await validateOAuthState(state)) {
        return NextResponse.redirect(
            new URL('/admin/settings?drive_error=invalid_state', request.url)
        );
    }

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
            new URL('/admin/settings?drive_error=token_exchange_failed', request.url)
        );
    }
}
