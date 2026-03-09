/**
 * Next.js Unified Middleware — Edge Security
 *
 * Combines route protection, rate limiting, admin Phoenix Protocol,
 * and correlation IDs into a single edge middleware.
 *
 * Security layers:
 * 1. Rate limiting (in-memory, per IP + route)
 * 2. Auth verification (JWT token from NextAuth)
 * 3. Route protection (admin, protected, user-only)
 * 4. Phoenix Protocol (dynamic admin paths)
 * 5. Correlation ID injection
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PROTECTED_ROUTES = ['/account', '/checkout'];
const USER_ONLY_ROUTES = ['/cart', '/checkout', '/custom', '/printing', '/account', '/complete-profile'];

const ROUTE_RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
    '/api/auth/register': { limit: 5, windowMs: 3600 * 1000 },
    '/api/auth/login': { limit: 10, windowMs: 60 * 1000 },
    '/api/auth/forgot-password': { limit: 3, windowMs: 3600 * 1000 },
    '/api/auth/reset-password': { limit: 5, windowMs: 3600 * 1000 },
    '/api/upload': { limit: 30, windowMs: 3600 * 1000 },
    '/api/orders/create': { limit: 10, windowMs: 60 * 1000 },
    '/api/send-email': { limit: 10, windowMs: 60 * 1000 },
};

const DEFAULT_RATE_LIMIT = { limit: 100, windowMs: 60 * 1000 };

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getRouteLimit(pathname: string): { limit: number; windowMs: number } {
    if (ROUTE_RATE_LIMITS[pathname]) {
        return ROUTE_RATE_LIMITS[pathname];
    }
    for (const [route, config] of Object.entries(ROUTE_RATE_LIMITS)) {
        if (pathname.startsWith(route)) {
            return config;
        }
    }
    return DEFAULT_RATE_LIMIT;
}

function checkRateLimit(ip: string, pathname: string): { allowed: boolean; resetIn: number } {
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

if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        rateLimitMap.forEach((value, key) => {
            if (now > value.resetTime) {
                rateLimitMap.delete(key);
            }
        });
    }, 60 * 1000);
}

function getClientIp(request: NextRequest): string {
    const cfIp = request.headers.get('cf-connecting-ip');
    if (cfIp) return cfIp;

    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp;

    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        const ips = forwardedFor.split(',').map(ip => ip.trim());
        return ips[0] || 'unknown';
    }

    return 'unknown';
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (
        pathname.startsWith('/_next') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    const ip = getClientIp(request);

    if (pathname.startsWith('/api')) {
        if (pathname.startsWith('/api/auth/callback') || pathname.startsWith('/api/auth/session')) {
            return NextResponse.next();
        }

        const { allowed, resetIn } = checkRateLimit(ip, pathname);
        if (!allowed) {
            return new NextResponse('Too Many Requests', {
                status: 429,
                headers: { 'Retry-After': String(resetIn) }
            });
        }

        const response = NextResponse.next();
        const correlationId = request.headers.get('X-Correlation-ID') ||
            `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
        response.headers.set('X-Correlation-ID', correlationId);
        return response;
    }

    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (!secret) {
        console.error('[Middleware] No AUTH_SECRET or NEXTAUTH_SECRET configured');
        return new NextResponse('Server configuration error', { status: 500 });
    }

    const token = await getToken({ req: request, secret });
    const isLoggedIn = !!token;
    const userRole = token?.role as string | undefined;
    const isAdmin = userRole === 'admin';

    const { allowed, resetIn } = checkRateLimit(ip, pathname);
    if (!allowed) {
        return new NextResponse('Too Many Requests', {
            status: 429,
            headers: { 'Retry-After': String(resetIn) }
        });
    }

    const isUserOnlyRoute = USER_ONLY_ROUTES.some(route =>
        pathname === route || pathname.startsWith(route + '/')
    );
    if (isAdmin && isUserOnlyRoute) {
        return NextResponse.redirect(new URL('/api/admin/launch', request.url));
    }

    const phoenixToken = request.cookies.get('admin_phoenix_token')?.value;

    if (phoenixToken && pathname.startsWith(`/${phoenixToken}`)) {
        if (!isLoggedIn || !isAdmin) {
            return NextResponse.redirect(new URL('/', request.url));
        }
        const internalPath = pathname.replace(`/${phoenixToken}`, '/sys_internal');
        return NextResponse.rewrite(new URL(internalPath, request.url));
    }

    if ((pathname === '/admin' || pathname.startsWith('/admin/')) && !pathname.startsWith('/admin/verify-2fa')) {
        return NextResponse.rewrite(new URL('/404', request.url));
    }

    if (pathname.startsWith('/sys_internal')) {
        if (!isLoggedIn || !isAdmin) {
            return NextResponse.rewrite(new URL('/404', request.url));
        }
    }

    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
    if (isProtectedRoute && !isLoggedIn) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
        if (isAdmin) {
            return NextResponse.redirect(new URL('/api/admin/launch', request.url));
        }
        if (token?.isNewUser) {
            return NextResponse.redirect(new URL('/complete-profile', request.url));
        }
        return NextResponse.redirect(new URL('/account', request.url));
    }

    if (isLoggedIn && pathname === '/complete-profile') {
        if (isAdmin) {
            return NextResponse.redirect(new URL('/api/admin/launch', request.url));
        }
        if (!token?.isNewUser) {
            return NextResponse.redirect(new URL('/account', request.url));
        }
    }

    const response = NextResponse.next();
    const correlationId = request.headers.get('X-Correlation-ID') ||
        `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    response.headers.set('X-Correlation-ID', correlationId);

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
    ],
};
