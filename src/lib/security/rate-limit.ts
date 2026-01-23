/**
 * Upload Rate Limiting
 * 
 * Specific rate limiting for file uploads
 * Separate from general API rate limiting for finer control
 */

// In-memory store for upload rate limiting
const uploadRateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Limits
const USER_UPLOAD_LIMIT = 10; // uploads per minute for normal users
const ADMIN_UPLOAD_LIMIT = 100; // uploads per minute for admin
const WINDOW_MS = 60 * 1000; // 1 minute

interface RateLimitResult {
    allowed: boolean;
    retryAfter?: number;
    remaining?: number;
}

/**
 * Check upload rate limit for a user
 * @param userId - User ID to check
 * @param isAdmin - Whether user is admin (higher limits)
 */
export async function checkUploadRateLimit(
    userId: string,
    isAdmin: boolean = false
): Promise<RateLimitResult> {
    const limit = isAdmin ? ADMIN_UPLOAD_LIMIT : USER_UPLOAD_LIMIT;
    const now = Date.now();
    const key = `upload:${userId}`;

    const record = uploadRateLimitStore.get(key);

    if (!record || now > record.resetTime) {
        // New window
        uploadRateLimitStore.set(key, { count: 1, resetTime: now + WINDOW_MS });
        return { allowed: true, remaining: limit - 1 };
    }

    if (record.count >= limit) {
        // Rate limited
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        return {
            allowed: false,
            retryAfter,
            remaining: 0
        };
    }

    // Increment count
    record.count++;
    return {
        allowed: true,
        remaining: limit - record.count
    };
}

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        uploadRateLimitStore.forEach((value, key) => {
            if (now > value.resetTime) {
                uploadRateLimitStore.delete(key);
            }
        });
    }, 5 * 60 * 1000);
}
