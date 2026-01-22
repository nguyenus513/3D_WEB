/**
 * NextAuth Middleware with Rate Limiting
 * 
 * Security features:
 * - Rate limiting (100 req/min per IP)
 * - Protected routes (login required)
 * - Admin access control (Phoenix Protocol)
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests
const RATE_WINDOW = 60 * 1000; // 1 minute

function rateLimit(ip: string): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
        return true;
    }

    if (record.count >= RATE_LIMIT) {
        return false; // Rate limited
    }

    record.count++;
    return true;
}

// Cleanup old entries periodically
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        rateLimitMap.forEach((value, key) => {
            if (now > value.resetTime) {
                rateLimitMap.delete(key);
            }
        });
    }, RATE_WINDOW);
}

export default auth((req) => {
    const { nextUrl } = req;

    // Rate limiting - get IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
        req.headers.get('x-real-ip') ||
        'unknown';

    if (!rateLimit(ip)) {
        return new NextResponse('Too Many Requests', {
            status: 429,
            headers: { 'Retry-After': '60' }
        });
    }

    const isLoggedIn = !!req.auth?.user;
    const userRole = (req.auth?.user as { role?: string } | undefined)?.role;
    const isAdmin = userRole === 'admin';
    const pathname = nextUrl.pathname;

    // Protected routes - require login
    const protectedRoutes = ['/account', '/checkout'];
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

    if (isProtectedRoute && !isLoggedIn) {
        const loginUrl = new URL('/login', nextUrl.origin);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Phoenix Protocol - Dynamic Admin Path
    const phoenixToken = req.cookies.get('admin_phoenix_token')?.value;

    // Check if current path STARTS with the phoenix token (if token exists)
    if (phoenixToken && pathname.startsWith(`/${phoenixToken}`)) {
        if (!isLoggedIn || !isAdmin) {
            return NextResponse.redirect(new URL('/', nextUrl.origin));
        }

        // Rewrite to internal system
        const internalPath = pathname.replace(`/${phoenixToken}`, '/sys_internal');
        return NextResponse.rewrite(new URL(internalPath, nextUrl.origin));
    }

    // Block direct access to /admin (It doesn't exist publicly)
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        return NextResponse.rewrite(new URL('/404', nextUrl.origin));
    }

    // Block direct access to sys_internal
    if (pathname.startsWith('/sys_internal')) {
        return NextResponse.rewrite(new URL('/404', nextUrl.origin));
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public assets
         * - api routes (handled separately)
         */
        '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
