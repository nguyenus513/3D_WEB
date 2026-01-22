import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { customAlphabet } from 'nanoid';

// 50-char generator with alphanumeric
const generateToken = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 50);

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    // 1. Verify session
    const session = await auth();
    const user = session?.user;
    const isAdmin = (user as { role?: string })?.role === 'admin';

    // 2. If not admin, redirect to home (security)
    if (!isAdmin) {
        const url = new URL(req.url);
        return NextResponse.redirect(new URL('/', url.origin));
    }

    // 3. Generate Random Phoenix Token (50 chars)
    const sessionToken = generateToken();

    // 4. Create Redirect to the new random path
    const url = new URL(req.url);
    const redirectUrl = new URL(`/${sessionToken}`, url.origin);

    const response = NextResponse.redirect(redirectUrl);

    // 5. Set Cookie to authorize this specific session token
    response.cookies.set('admin_phoenix_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });

    console.log(`[Phoenix Protocol] Admin session launched. Path: /${sessionToken.substring(0, 10)}...`);
    return response;
}
