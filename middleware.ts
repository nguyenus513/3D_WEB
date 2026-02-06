/**
 * Edge Middleware
 *
 * - Rate limiting (Redis-backed)
 * - Protected routes (login required)
 * - Admin access control (Phoenix Protocol)
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/security/redis-rate-limit';

const PROTECTED_ROUTES = ['/account', '/checkout'];
const USER_ONLY_ROUTES = ['/cart', '/checkout', '/custom', '/printing', '/account', '/complete-profile'];

function getClientIp(req: Request): string {
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    return forwarded?.split(',')[0]?.trim() || realIp || cfConnectingIp || 'unknown';
}

function getRateLimitType(pathname: string): Parameters<typeof checkRateLimit>[1] {
    if (pathname.startsWith('/api/auth/login')) return 'auth:login';
    if (pathname.startsWith('/api/auth/register')) return 'auth:register';
    if (pathname.startsWith('/api/auth/verify')) return 'auth:verify';
    if (pathname.startsWith('/api/auth/forgot-password') || pathname.startsWith('/api/auth/reset-password')) {
        return 'auth:forgot-password';
    }
    if (pathname.startsWith('/api/send-email')) return 'send-email';
    if (pathname.startsWith('/api/analyze-stl')) return 'analyze-stl';
    if (pathname.startsWith('/api/upload')) return 'upload';
    if (pathname.startsWith('/api/drive')) return 'drive';
    if (pathname.startsWith('/api/admin')) return 'admin';
    return 'default';
}

export const middleware = auth(async (req) => {
    const { nextUrl } = req;
    const pathname = nextUrl.pathname;

    // Skip static assets
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon.ico') ||
        pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$/)
    ) {
        return NextResponse.next();
    }

    // Rate limiting for API routes
    if (pathname.startsWith('/api')) {
        const ip = getClientIp(req);
        const limitType = getRateLimitType(pathname);
        const key = `${limitType}:${ip}`;
        const { allowed, resetIn } = await checkRateLimit(key, limitType);

        if (!allowed) {
            return new NextResponse('Too Many Requests', {
                status: 429,
                headers: { 'Retry-After': String(resetIn) }
            });
        }
    }

    const isLoggedIn = !!req.auth?.user;
    const userRole = (req.auth?.user as { role?: string } | undefined)?.role;
    const isAdmin = userRole === 'admin';

    // Protected routes - require login
    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
    if (isProtectedRoute && !isLoggedIn) {
        const loginUrl = new URL('/login', nextUrl.origin);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Block ADMIN from user routes
    const isUserOnlyRoute = USER_ONLY_ROUTES.some(route =>
        pathname === route || pathname.startsWith(route + '/')
    );
    if (isAdmin && isUserOnlyRoute) {
        return NextResponse.redirect(new URL('/api/admin/launch', nextUrl.origin));
    }

    // Phoenix Protocol - Dynamic Admin Path
    const phoenixToken = req.cookies.get('admin_phoenix_token')?.value;
    if (phoenixToken && pathname.startsWith(`/${phoenixToken}`)) {
        if (!isLoggedIn || !isAdmin) {
            return NextResponse.redirect(new URL('/', nextUrl.origin));
        }

        const internalPath = pathname.replace(`/${phoenixToken}`, '/sys_internal');
        return NextResponse.rewrite(new URL(internalPath, nextUrl.origin));
    }

    // Block direct access to /admin and /sys_internal
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        return NextResponse.rewrite(new URL('/404', nextUrl.origin));
    }

    if (pathname.startsWith('/sys_internal')) {
        return NextResponse.rewrite(new URL('/404', nextUrl.origin));
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
