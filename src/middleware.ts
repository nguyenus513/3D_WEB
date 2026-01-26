/**
 * Next.js Middleware for Role-Based Access Control
 * 
 * Rules:
 * - Admin accounts: Can ONLY access admin routes (/{token}/*) 
 * - User accounts: Can ONLY access user routes (shop, cart, account, etc.)
 * - Public routes: Accessible by all
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Routes that USER (customer) cannot access
const ADMIN_ROUTE_PATTERN = /^\/[A-Za-z0-9]{40,60}(\/.*)?$/;

// Routes that ADMIN cannot access (user-only routes)
const USER_ONLY_ROUTES = [
    '/cart',
    '/checkout',
    '/custom',
    '/printing',
    '/account',
    '/complete-profile',
];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // IMPORTANT: Skip ALL API routes to prevent infinite loops
    if (pathname.startsWith('/api')) {
        return NextResponse.next();
    }

    // Skip static files
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // Get JWT token (doesn't make API call, reads cookie directly)
    const token = await getToken({
        req: request,
        secret: process.env.AUTH_SECRET
    });

    // Not logged in - allow public routes
    if (!token) {
        return NextResponse.next();
    }

    const role = token.role as string;

    // ==========================================
    // ADMIN ROLE: Block access to USER routes
    // ==========================================
    if (role === 'admin') {
        const isUserRoute = USER_ONLY_ROUTES.some(route =>
            pathname === route || pathname.startsWith(route + '/')
        );

        if (isUserRoute) {
            console.log(`[Middleware] Admin blocked from: ${pathname}`);
            return NextResponse.redirect(new URL('/api/admin/launch', request.url));
        }
    }

    // ==========================================
    // USER ROLE: Block access to ADMIN routes
    // ==========================================
    if (role === 'customer' || !role) {
        // Admin routes are 50-char token paths
        if (ADMIN_ROUTE_PATTERN.test(pathname)) {
            console.log(`[Middleware] User blocked from admin route: ${pathname}`);
            return NextResponse.redirect(new URL('/', request.url));
        }

        // Also block /sys_internal
        if (pathname.startsWith('/sys_internal')) {
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api).*)',
    ],
};
