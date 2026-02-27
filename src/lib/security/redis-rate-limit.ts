/**
 * Redis Rate Limiter
 * 
 * Production-ready rate limiting with Redis backend.
 * Falls back to in-memory if Redis not configured.
 * 
 * Usage:
 * - Set REDIS_URL env var to enable Redis
 * - Otherwise uses in-memory (not suitable for multi-instance)
 */

import { Redis } from '@upstash/redis';

// Rate limit configs (shared with api-rate-limit.ts)
export const RATE_LIMITS = {
    // Auth routes - strict
    'auth:login': { limit: 10, windowSeconds: 900 }, // 10 per 15 min
    'auth:register': { limit: 5, windowSeconds: 3600 }, // 5 per hour
    'auth:verify': { limit: 10, windowSeconds: 900 },
    'auth:forgot-password': { limit: 3, windowSeconds: 3600 },

    // Sensitive endpoints
    'send-email': { limit: 10, windowSeconds: 60 }, // 10 per minute
    'analyze-stl': { limit: 5, windowSeconds: 60 }, // 5 per minute
    'upload': { limit: 30, windowSeconds: 3600 }, // 30 per hour
    'drive': { limit: 5, windowSeconds: 3600 }, // 5 per hour

    // Admin routes
    'admin': { limit: 100, windowSeconds: 60 }, // 100 per minute

    // Default
    'default': { limit: 100, windowSeconds: 60 },
};

// Redis client (lazy initialized)
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
    if (redisClient) return redisClient;

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
        return null;
    }

    redisClient = new Redis({
        url: redisUrl,
        token: redisToken,
    });

    return redisClient;
}

// In-memory fallback
const memoryStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Check rate limit using Redis (or fallback to memory)
 */
export async function checkRateLimit(
    key: string,
    limitType: keyof typeof RATE_LIMITS = 'default'
): Promise<{
    allowed: boolean;
    remaining: number;
    resetIn: number;
}> {
    const config = RATE_LIMITS[limitType] || RATE_LIMITS.default;
    const redis = getRedisClient();

    if (redis) {
        try {
            // Race with a 3-second timeout to prevent hanging
            const timeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Redis timeout')), 3000)
            );
            return await Promise.race([
                checkRateLimitRedis(redis, key, config),
                timeout,
            ]);
        } catch (err) {
            console.warn('[RateLimit] Redis failed, falling back to memory:', (err as Error).message);
            return checkRateLimitMemory(key, config);
        }
    }

    return checkRateLimitMemory(key, config);
}

/**
 * Redis-based rate limiting using sliding window
 */
async function checkRateLimitRedis(
    redis: Redis,
    key: string,
    config: { limit: number; windowSeconds: number }
): Promise<{
    allowed: boolean;
    remaining: number;
    resetIn: number;
}> {
    const redisKey = `ratelimit:${key}`;

    // Use INCR with EXPIRE for simple sliding window
    const count = await redis.incr(redisKey);

    if (count === 1) {
        // First request, set expiry
        await redis.expire(redisKey, config.windowSeconds);
    }

    const ttl = await redis.ttl(redisKey);

    if (count > config.limit) {
        return {
            allowed: false,
            remaining: 0,
            resetIn: ttl > 0 ? ttl : config.windowSeconds,
        };
    }

    return {
        allowed: true,
        remaining: config.limit - count,
        resetIn: ttl > 0 ? ttl : config.windowSeconds,
    };
}

/**
 * In-memory rate limiting (fallback)
 */
function checkRateLimitMemory(
    key: string,
    config: { limit: number; windowSeconds: number }
): {
    allowed: boolean;
    remaining: number;
    resetIn: number;
} {
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const record = memoryStore.get(key);

    if (!record || now > record.resetTime) {
        memoryStore.set(key, { count: 1, resetTime: now + windowMs });
        return {
            allowed: true,
            remaining: config.limit - 1,
            resetIn: config.windowSeconds,
        };
    }

    if (record.count >= config.limit) {
        return {
            allowed: false,
            remaining: 0,
            resetIn: Math.ceil((record.resetTime - now) / 1000),
        };
    }

    record.count++;
    return {
        allowed: true,
        remaining: config.limit - record.count,
        resetIn: Math.ceil((record.resetTime - now) / 1000),
    };
}

/**
 * Reset rate limit for a key (for testing/admin)
 */
export async function resetRateLimit(key: string): Promise<void> {
    const redis = getRedisClient();

    if (redis) {
        await redis.del(`ratelimit:${key}`);
    } else {
        memoryStore.delete(key);
    }
}

// Cleanup old memory entries every 5 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        memoryStore.forEach((value, key) => {
            if (now > value.resetTime) {
                memoryStore.delete(key);
            }
        });
    }, 5 * 60 * 1000);
}

/**
 * Check if Redis is available
 */
export function isRedisConfigured(): boolean {
    return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}
