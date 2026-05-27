import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { getMongoCollections } from '@/lib/mongodb';
import { getTwoFactorCookieName, getTwoFactorSessionFingerprint, verifyTwoFactorCookie } from '@/lib/security/twofa-cookie';
import { customAlphabet } from 'nanoid';

// 50-char generator with alphanumeric
const generateToken = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 50);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const loginUrl = new URL('/login', url.origin);
    loginUrl.searchParams.set('callbackUrl', '/admin/verify-2fa');

    const { authorized, response: authResponse, userId, session } = await requireAdmin(request, true);
    if (!authorized || !userId) {
        return authResponse?.status === 401
            ? NextResponse.redirect(loginUrl)
            : NextResponse.redirect(new URL('/', url.origin));
    }

    const { profiles } = await getMongoCollections();
    const profile = await profiles.findOne({ _id: userId });
    if (profile?.totp_enabled) {
        const verified = await verifyTwoFactorCookie(request.cookies.get(getTwoFactorCookieName())?.value, {
            userId,
            email: session?.user?.email,
            sessionFingerprint: await getTwoFactorSessionFingerprint(request.cookies),
        });
        if (!verified) return NextResponse.redirect(new URL('/admin/verify-2fa', url.origin));
    }

    const existingToken = request.cookies.get('admin_phoenix_token')?.value;
    if (existingToken && /^[0-9A-Za-z]{50}$/.test(existingToken)) {
        return NextResponse.redirect(new URL(`/${existingToken}`, url.origin));
    }

    // 3. Generate Random Phoenix Token (50 chars)
    const sessionToken = generateToken();

    // 4. Create Redirect to the new random path
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
