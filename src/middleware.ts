/**
 * Next.js Middleware
 *
 * Centralized request processing:
 * - Admin route protection
 * - Security headers injection
 * - Request logging
 *
 * Runs on Edge Runtime for every matched request.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// ─── Route Classification ───────────────────────────────────────────

/** Routes that require admin role */
const ADMIN_ROUTES = ['/sys_internal', '/api/admin'];

/** Routes that require any authenticated user */
const PROTECTED_ROUTES = ['/account', '/api/orders', '/api/addresses', '/api/cart'];

/** Public routes — no auth required */
const PUBLIC_ROUTES = ['/', '/login', '/register', '/products', '/custom', '/printing', '/api/auth', '/api/payment/webhook'];

// ─── Middleware ─────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip static assets and Next.js internals
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // Get JWT token from session cookie
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
    });

    const isAuthenticated = !!token;
    const userRole = (token?.role as string) || 'customer';

    // ─── Admin Route Protection ─────────────────────────────────

    const isAdminRoute = ADMIN_ROUTES.some(r => pathname.startsWith(r));
    if (isAdminRoute) {
        if (!isAuthenticated) {
            // Redirect to login for page routes, 401 for API
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Authentication required' },
                    { status: 401 }
                );
            }
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(loginUrl);
        }

        if (userRole !== 'admin') {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Forbidden — admin access required' },
                    { status: 403 }
                );
            }
            return NextResponse.redirect(new URL('/', request.url));
        }

        // ─── 2FA Check for Admin Page Routes ────────────────────
        // Uses JWT twoFactorEnabled flag — no DB call needed in edge runtime
        // Skip for: API routes (handled by admin-guard), verify-2fa page
        const is2FAExempt =
            pathname.startsWith('/api/') ||
            pathname.startsWith('/admin/verify-2fa');

        const hasTwoFactorEnabled = token?.twoFactorEnabled === true;

        if (!is2FAExempt && hasTwoFactorEnabled) {
            const twoFACookie = request.cookies.get('2fa-verified');

            if (!twoFACookie || twoFACookie.value !== (token?.id as string)) {
                const verifyUrl = new URL('/admin/verify-2fa', request.url);
                const res = NextResponse.redirect(verifyUrl);
                // Clear invalid cookie if present
                if (twoFACookie) {
                    res.cookies.delete('2fa-verified');
                }
                return res;
            }
        }
    }

    // ─── Protected Route Check ──────────────────────────────────

    const isProtectedRoute = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
    if (isProtectedRoute && !isAuthenticated) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // ─── Continue ───────────────────────────────────────────────

    const response = NextResponse.next();

    // Add correlation ID for request tracing
    const correlationId = request.headers.get('X-Correlation-ID') ||
        `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    response.headers.set('X-Correlation-ID', correlationId);

    return response;
}

// ─── Matcher ────────────────────────────────────────────────────────

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next (ALL Next.js internals: static, image, webpack-hmr, etc.)
         * - api/auth (NextAuth endpoints — must not be intercepted)
         * - favicon.ico
         * - Public static files (images, fonts, etc.)
         */
        '/((?!_next|api/auth|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
    ],
};
