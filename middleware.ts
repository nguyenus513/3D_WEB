/**
 * Next.js Middleware for Edge Security
 *
 * Protects routes at the Edge before they reach the application:
 * - /admin/* and /sys_internal/* - Admin only
 * - /account/* - Authenticated users only
 * - Auto-refreshes Supabase sessions
 *
 * @see DEVELOPMENT_GUIDE.md - Security Layer
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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

    // Create Supabase client for Edge
    let response = NextResponse.next({
        request: { headers: request.headers },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value);
                        response = NextResponse.next({
                            request: { headers: request.headers },
                        });
                        response.cookies.set({ name, value, ...options });
                    });
                },
            },
        }
    );

    // Refresh session (important for keeping sessions alive)
    const { data: { user } } = await supabase.auth.getUser();

    // ==========================================================================
    // Route Protection Logic
    // ==========================================================================

    // Check if route requires admin
    const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));
    if (isAdminRoute) {
        if (!user) {
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('redirect', pathname);
            return NextResponse.redirect(loginUrl);
        }

        // Check admin role from profiles table (via session metadata)
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || profile.role !== 'admin') {
            // Not an admin -> redirect to home with error
            const homeUrl = new URL('/', request.url);
            homeUrl.searchParams.set('error', 'unauthorized');
            return NextResponse.redirect(homeUrl);
        }
    }

    // Check if route requires authentication
    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
    if (isProtectedRoute && !user) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Redirect logged-in users away from auth pages
    if (user && (pathname === '/login' || pathname === '/register')) {
        return NextResponse.redirect(new URL('/account', request.url));
    }

    return response;
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
