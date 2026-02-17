import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { customAlphabet } from 'nanoid';

// 50-char generator with alphanumeric
const generateToken = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 50);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    // SECURITY: Verify admin
    const { authorized, response: authResponse } = await requireAdmin(request);
    if (!authorized) return authResponse!;

    // 3. Generate Random Phoenix Token (50 chars)
    const sessionToken = generateToken();

    // 4. Create Redirect to the new random path
    const url = new URL(request.url);
    const redirectUrl = new URL(`/${sessionToken}`, url.origin);

    const response = NextResponse.redirect(redirectUrl);

    // 5. Set Cookie to authorize this specific session token
    response.cookies.set('admin_phoenix_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });

    return response;
}
