/**
 * NextAuth Middleware with Enhanced Rate Limiting
 * 
 * Security features:
 * - Route-specific rate limiting
 * - Protected routes (login required)
 * - Admin access control (Phoenix Protocol)
 * - CSRF validation (optional strict mode)
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';

// Enhanced rate limiter with route-specific limits
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// TEMPORARILY DISABLED FOR DEBUGGING - increase limits significantly
const ROUTE_RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
    '/api/auth/register': { limit: 1000, windowMs: 60 * 1000 }, // Increased for debugging
    '/api/auth/login': { limit: 1000, windowMs: 60 * 1000 }, // Increased for debugging
    '/api/auth/forgot-password': { limit: 100, windowMs: 60 * 1000 }, // Increased
    '/api/auth/reset-password': { limit: 100, windowMs: 60 * 1000 }, // Increased
    '/api/upload': { limit: 100, windowMs: 60 * 1000 },
    '/api/orders/create': { limit: 100, windowMs: 60 * 1000 },
    '/api/send-email': { limit: 100, windowMs: 60 * 1000 },
};

// Default rate limit for other routes
const DEFAULT_RATE_LIMIT = { limit: 1000, windowMs: 60 * 1000 }; // Increased for debugging

function getRouteLimit(pathname: string): { limit: number; windowMs: number } {
    // Check for exact match first
    if (ROUTE_RATE_LIMITS[pathname]) {
        return ROUTE_RATE_LIMITS[pathname];
    }
    // Check for prefix match
    for (const [route, config] of Object.entries(ROUTE_RATE_LIMITS)) {
        if (pathname.startsWith(route)) {
            return config;
        }
    }
    return DEFAULT_RATE_LIMIT;
}

function rateLimit(ip: string, pathname: string): { allowed: boolean; resetIn: number } {
    const now = Date.now();
    const routeConfig = getRouteLimit(pathname);
    const key = `${ip}:${pathname}`;
    const record = rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
        rateLimitMap.set(key, { count: 1, resetTime: now + routeConfig.windowMs });
        return { allowed: true, resetIn: Math.ceil(routeConfig.windowMs / 1000) };
    }

    if (record.count >= routeConfig.limit) {
        return { allowed: false, resetIn: Math.ceil((record.resetTime - now) / 1000) };
    }

    record.count++;
    return { allowed: true, resetIn: Math.ceil((record.resetTime - now) / 1000) };
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
    }, 60 * 1000); // Cleanup every minute
}

export const proxy = auth((req) => {
    const { nextUrl } = req;
    const pathname = nextUrl.pathname;

    // Rate limiting - get IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
        req.headers.get('x-real-ip') ||
        req.headers.get('cf-connecting-ip') ||
        'unknown';

    const { allowed, resetIn } = rateLimit(ip, pathname);
    if (!allowed) {
        return new NextResponse('Too Many Requests', {
            status: 429,
            headers: { 'Retry-After': String(resetIn) }
        });
    }

    const isLoggedIn = !!req.auth?.user;
    const userRole = (req.auth?.user as { role?: string } | undefined)?.role;
    const isAdmin = userRole === 'admin';

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
         * - public assets (images)
         * 
         * NOTE: API routes ARE included for rate limiting
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
