/**
 * Next.js Middleware for Edge Security
 *
 * Protects routes at the Edge before they reach the application:
 * - /admin/* and /sys_internal/* - Admin only
 * - /account/* and /checkout/* - Authenticated users only
 * - Uses NextAuth JWT token for session verification
 *
 * @see DEVELOPMENT_GUIDE.md - Security Layer
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// =============================================================================
// Route Patterns
// =============================================================================

const PROTECTED_ROUTES = ['/account', '/checkout'];
const ADMIN_ROUTES = ['/admin', '/sys_internal'];
const PUBLIC_ROUTES = ['/', '/login', '/register', '/products', '/about', '/contact', '/printing', '/custom'];

// =============================================================================
// Middleware
// =============================================================================

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip static files and API routes (API has its own auth)
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.includes('.') // Static files
    ) {
        return NextResponse.next();
    }

    // Get NextAuth JWT token
    // Note: Edge Runtime needs explicit secret - AUTH_SECRET is the v5 standard
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (!secret) {
        console.error('[MIDDLEWARE ERROR] No AUTH_SECRET or NEXTAUTH_SECRET found');
        return NextResponse.next();
    }

    const token = await getToken({
        req: request,
        secret: secret
    });

    // Debug logging (remove in production)
    console.log('[MIDDLEWARE DEBUG] Path:', pathname);
    console.log('[MIDDLEWARE DEBUG] Token exists:', !!token);
    console.log('[MIDDLEWARE DEBUG] Token role:', token?.role);

    // ==========================================================================
    // Route Protection Logic
    // ==========================================================================

    // Check if route requires admin
    const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));
    if (isAdminRoute) {
        if (!token) {
            console.log('[MIDDLEWARE DEBUG] No token, redirecting to login');
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(loginUrl);
        }

        // Check admin role from token
        if (token.role !== 'admin') {
            console.log('[MIDDLEWARE DEBUG] Not admin, redirecting to home');
            const homeUrl = new URL('/', request.url);
            homeUrl.searchParams.set('error', 'unauthorized');
            return NextResponse.redirect(homeUrl);
        }
    }

    // Check if route requires authentication
    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
    if (isProtectedRoute && !token) {
        console.log('[MIDDLEWARE DEBUG] Protected route without token, redirecting to login');
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Redirect logged-in users away from auth pages
    if (token && (pathname === '/login' || pathname === '/register')) {
        console.log('[MIDDLEWARE DEBUG] Logged in user on auth page, redirecting to account');
        return NextResponse.redirect(new URL('/account', request.url));
    }

    return NextResponse.next();
}

// =============================================================================
// Matcher Configuration
// =============================================================================

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
