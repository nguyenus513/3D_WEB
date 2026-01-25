/**
 * CSRF Protection
 * 
 * Implements Double Submit Cookie pattern for CSRF protection.
 * Works with both server components and API routes.
 */

import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';

// Cookie name - use __Host- prefix for extra security (only works on HTTPS)
const CSRF_COOKIE_NAME = process.env.NODE_ENV === 'production' 
    ? '__Host-csrf-token' 
    : 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;
const TOKEN_EXPIRY_SECONDS = 60 * 60; // 1 hour

/**
 * Generate a new CSRF token
 */
export function generateCsrfToken(): string {
    return nanoid(TOKEN_LENGTH);
}

/**
 * Set CSRF cookie (call in layout or middleware)
 * Returns the token for client use
 */
export async function setCsrfCookie(): Promise<string> {
    const token = generateCsrfToken();
    const cookieStore = await cookies();
    
    cookieStore.set(CSRF_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: TOKEN_EXPIRY_SECONDS,
    });
    
    return token;
}

/**
 * Get CSRF token from cookie
 */
export async function getCsrfToken(): Promise<string | undefined> {
    const cookieStore = await cookies();
    return cookieStore.get(CSRF_COOKIE_NAME)?.value;
}

/**
 * Validate CSRF token from request
 * Compares cookie token with header token using constant-time comparison
 */
export async function validateCsrfToken(request: Request): Promise<boolean> {
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
    const headerToken = request.headers.get(CSRF_HEADER_NAME);
    
    if (!cookieToken || !headerToken) {
        return false;
    }
    
    // Constant-time comparison to prevent timing attacks
    return constantTimeCompare(cookieToken, headerToken);
}

/**
 * Constant-time string comparison
 */
function constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
}

/**
 * Validate CSRF for API route handler
 * Use as a wrapper or at the start of POST/PUT/DELETE handlers
 */
export async function requireCsrf(request: Request): Promise<{ valid: boolean; error?: Response }> {
    const isValid = await validateCsrfToken(request);
    
    if (!isValid) {
        return {
            valid: false,
            error: new Response(
                JSON.stringify({ error: 'Invalid or missing CSRF token' }),
                { 
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                }
            ),
        };
    }
    
    return { valid: true };
}

/**
 * Create a client-side CSRF token provider for React components
 * Include this in your layout to make CSRF token available client-side
 */
export async function getCsrfTokenForClient(): Promise<string> {
    let token = await getCsrfToken();
    
    if (!token) {
        token = await setCsrfCookie();
    }
    
    return token;
}

/**
 * Export constants for client use
 */
export const CSRF_CONFIG = {
    headerName: CSRF_HEADER_NAME,
    cookieName: CSRF_COOKIE_NAME,
} as const;
