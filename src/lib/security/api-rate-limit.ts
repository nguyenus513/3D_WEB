/**
 * API Rate Limiting Utility (Redis-backed)
 * 
 * Per-route rate limiting for API endpoints.
 * Uses Upstash Redis when configured, falls back to in-memory via redis-rate-limit.
 */

import { checkRateLimit } from './redis-rate-limit';

// Route -> limit type mapping
function getLimitType(pathname: string): Parameters<typeof checkRateLimit>[1] {
    if (pathname.startsWith('/api/auth/register')) return 'auth:register';
    if (pathname.startsWith('/api/auth/login')) return 'auth:login';
    if (pathname.startsWith('/api/auth/verify')) return 'auth:verify';
    if (pathname.startsWith('/api/auth/forgot-password') || pathname.startsWith('/api/auth/reset-password')) {
        return 'auth:forgot-password';
    }
    if (pathname.startsWith('/api/upload')) return 'upload';
    if (pathname.startsWith('/api/send-email')) return 'send-email';
    if (pathname.startsWith('/api/analyze-stl')) return 'analyze-stl';
    if (pathname.startsWith('/api/drive')) return 'drive';
    if (pathname.startsWith('/api/admin')) return 'admin';
    return 'default';
}

/**
 * Get client identifier for rate limiting
 */
export function getClientId(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';

    const userAgent = request.headers.get('user-agent') || 'unknown';
    const fingerprint = `${ip}:${hashString(userAgent)}`;

    return fingerprint;
}

/**
 * Simple hash function for fingerprinting
 */
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * Check if request is rate limited
 * Returns true if request should be blocked
 */
export async function isRateLimited(request: Request): Promise<{ limited: boolean; remaining: number; resetIn: number }> {
    const clientId = getClientId(request);
    const url = new URL(request.url);
    const pathname = url.pathname;

    const limitType = getLimitType(pathname);
    const key = `${limitType}:${clientId}`;

    const result = await checkRateLimit(key, limitType);

    return {
        limited: !result.allowed,
        remaining: result.remaining,
        resetIn: result.resetIn * 1000, // convert to ms for compatibility
    };
}

/**
 * Create rate limit response headers
 */
export function getRateLimitHeaders(remaining: number, resetIn: number): Record<string, string> {
    return {
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(resetIn / 1000).toString(),
    };
}

/**
 * Rate limit response (429 Too Many Requests)
 */
export function rateLimitedResponse(resetIn: number): Response {
    return new Response(JSON.stringify({
        error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
        retryAfter: Math.ceil(resetIn / 1000)
    }), {
        status: 429,
        headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(resetIn / 1000).toString(),
            ...getRateLimitHeaders(0, resetIn),
        },
    });
}
