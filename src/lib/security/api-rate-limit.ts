/**
 * API Rate Limiting Utility
 * 
 * Per-route rate limiting for API endpoints
 * More granular than middleware-level rate limiting
 */

// Rate limit configurations by route pattern
export const API_RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
    // Auth routes - strict limits to prevent brute force
    '/api/auth/register': { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
    '/api/auth/login': { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 min
    '/api/auth/verify': { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 min
    '/api/auth/resend': { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
    '/api/auth/forgot-password': { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour

    // Upload routes - moderate limits
    '/api/upload': { limit: 30, windowMs: 60 * 60 * 1000 }, // 30 per hour

    // Email - very strict to prevent spam/abuse
    '/api/send-email': { limit: 10, windowMs: 60 * 1000 }, // 10 per minute

    // STL Analysis - compute-heavy, strict limit
    '/api/analyze-stl': { limit: 5, windowMs: 60 * 1000 }, // 5 per minute

    // Drive OAuth - one-time action, very strict
    '/api/drive': { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour

    // Admin routes - higher limits but still bounded
    '/api/admin': { limit: 100, windowMs: 60 * 1000 }, // 100 per minute

    // Public API - standard limits
    '/api/products': { limit: 60, windowMs: 60 * 1000 }, // 60 per minute
    '/api/featured-products': { limit: 60, windowMs: 60 * 1000 }, // 60 per minute

    // Default for unspecified routes
    'default': { limit: 100, windowMs: 60 * 1000 }, // 100 per minute
};

// In-memory store for rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Get client identifier for rate limiting
 */
export function getClientId(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';

    // Combine IP with user agent for better fingerprinting
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
 * Get rate limit config for a route
 */
function getRouteConfig(pathname: string): { limit: number; windowMs: number } {
    // Check exact match first
    if (API_RATE_LIMITS[pathname]) {
        return API_RATE_LIMITS[pathname];
    }

    // Check prefix match (e.g., /api/admin/* matches /api/admin)
    for (const [route, config] of Object.entries(API_RATE_LIMITS)) {
        if (route !== 'default' && pathname.startsWith(route)) {
            return config;
        }
    }

    return API_RATE_LIMITS['default'];
}

/**
 * Check if request is rate limited
 * Returns true if request should be blocked
 */
export function isRateLimited(request: Request): { limited: boolean; remaining: number; resetIn: number } {
    const clientId = getClientId(request);
    const url = new URL(request.url);
    const pathname = url.pathname;

    const config = getRouteConfig(pathname);
    const key = `${clientId}:${pathname}`;
    const now = Date.now();

    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
        // New window
        rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs });
        return { limited: false, remaining: config.limit - 1, resetIn: config.windowMs };
    }

    if (record.count >= config.limit) {
        // Rate limited
        return {
            limited: true,
            remaining: 0,
            resetIn: record.resetTime - now
        };
    }

    // Increment count
    record.count++;
    return {
        limited: false,
        remaining: config.limit - record.count,
        resetIn: record.resetTime - now
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

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        rateLimitStore.forEach((value, key) => {
            if (now > value.resetTime) {
                rateLimitStore.delete(key);
            }
        });
    }, 5 * 60 * 1000);
}
