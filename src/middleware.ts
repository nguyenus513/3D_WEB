/**
 * Next.js Middleware for Role-Based Access Control
 * 
 * Rules:
 * - Admin accounts: Can ONLY access admin routes (/{token}/*) 
 * - User accounts: Can ONLY access user routes (shop, cart, account, etc.)
 * - Public routes: Accessible by all (/, /products, /login, /register, /api)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';

// Routes that are PUBLIC (no auth required)
const PUBLIC_ROUTES = [
    '/',
    '/products',
    '/login',
    '/register',
    '/forgot-password',
    '/faq',
    '/about',
    '/privacy',
    '/terms',
];

// Routes that are USER-ONLY (customers)
const USER_ROUTES = [
    '/cart',
    '/checkout',
    '/custom',
    '/printing',
    '/account',
    '/complete-profile',
];

// API routes that should be accessible by all authenticated users
const SHARED_API_ROUTES = [
    '/api/auth',
    '/api/upload',
];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip static files and internal Next.js routes
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname.includes('.') // Files with extensions
    ) {
        return NextResponse.next();
    }

    // Skip public routes
    if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
        // But check if it's a product page - that should still be public
        if (pathname.startsWith('/products')) {
            return NextResponse.next();
        }
    }

    // Skip shared API routes
    if (SHARED_API_ROUTES.some(route => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // Get session
    const session = await auth();
    const user = session?.user;
    const role = (user as { role?: string })?.role;

    // Not logged in - redirect to login for protected routes
    if (!user) {
        // Public routes are OK
        if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
            return NextResponse.next();
        }
        // Protected route - redirect to login
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // ==========================================
    // ADMIN ROLE: Block access to USER routes
    // ==========================================
    if (role === 'admin') {
        // Check if trying to access user-only routes
        const isUserRoute = USER_ROUTES.some(route =>
            pathname === route || pathname.startsWith(route + '/')
        );

        if (isUserRoute) {
            // Redirect admin to admin dashboard
            console.log(`[Middleware] Admin blocked from user route: ${pathname}`);
            return NextResponse.redirect(new URL('/api/admin/launch', request.url));
        }
    }

    // ==========================================
    // USER ROLE: Block access to ADMIN routes
    // ==========================================
    if (role === 'customer' || !role) {
        // Check if trying to access admin routes (dynamic token paths)
        // Admin routes start with a 50-char alphanumeric token
        const isAdminRoute = /^\/[A-Za-z0-9]{40,60}(\/.*)?$/.test(pathname);

        if (isAdminRoute) {
            // Redirect user to home
            console.log(`[Middleware] User blocked from admin route: ${pathname}`);
            return NextResponse.redirect(new URL('/', request.url));
        }

        // Also block /sys_internal (if exists)
        if (pathname.startsWith('/sys_internal')) {
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|public).*)',
    ],
};
