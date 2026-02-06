/**
 * Upload Rate Limiting
 *
 * Uses Redis-backed rate limiting when configured.
 */

import { checkRateLimit } from './redis-rate-limit';

interface RateLimitResult {
    allowed: boolean;
    retryAfter?: number;
    remaining?: number;
}

/**
 * Check upload rate limit for a user
 */
export async function checkUploadRateLimit(
    userId: string,
    isAdmin: boolean = false
): Promise<RateLimitResult> {
    // Admins get higher limits by using a separate key namespace
    const key = isAdmin ? `upload:admin:${userId}` : `upload:user:${userId}`;

    const result = await checkRateLimit(key, 'upload');

    if (!result.allowed) {
        return {
            allowed: false,
            retryAfter: result.resetIn,
            remaining: 0,
        };
    }

    return {
        allowed: true,
        remaining: result.remaining,
    };
}
