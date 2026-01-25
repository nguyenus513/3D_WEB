/**
 * Health Check Endpoint
 * 
 * GET /api/health
 * 
 * Returns system health status for monitoring.
 * Used by uptime monitors, load balancers, and deployment checks.
 */

import { NextResponse } from 'next/server';

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    environment: string;
    checks: {
        database: 'ok' | 'error' | 'unknown';
        redis: 'ok' | 'not_configured' | 'error';
        storage: 'ok' | 'not_configured' | 'error';
    };
    uptime: number;
    responseTime?: number;
}

// Track server start time for uptime calculation
const startTime = Date.now();

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<'ok' | 'error' | 'unknown'> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        return 'unknown';
    }

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
            },
            // Short timeout for health check
            signal: AbortSignal.timeout(5000),
        });
        
        return response.ok ? 'ok' : 'error';
    } catch {
        return 'error';
    }
}

/**
 * Check Redis connectivity (Upstash)
 */
async function checkRedis(): Promise<'ok' | 'not_configured' | 'error'> {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!redisUrl || !redisToken) {
        return 'not_configured';
    }

    try {
        const response = await fetch(`${redisUrl}/ping`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${redisToken}`,
            },
            signal: AbortSignal.timeout(3000),
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.result === 'PONG' ? 'ok' : 'error';
        }
        return 'error';
    } catch {
        return 'error';
    }
}

/**
 * Check storage connectivity (Cloudflare R2)
 */
async function checkStorage(): Promise<'ok' | 'not_configured' | 'error'> {
    const r2Endpoint = process.env.R2_ENDPOINT;
    const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
    
    if (!r2Endpoint || !r2AccessKey) {
        return 'not_configured';
    }

    // For R2, we just check if credentials are configured
    // Actual connectivity check would require signing a request
    return 'ok';
}

/**
 * GET /api/health
 */
export async function GET(): Promise<NextResponse<HealthStatus>> {
    const requestStart = Date.now();
    
    // Run all checks in parallel
    const [database, redis, storage] = await Promise.all([
        checkDatabase(),
        checkRedis(),
        checkStorage(),
    ]);

    const checks = { database, redis, storage };
    
    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (checks.database === 'error') {
        // Database is critical
        status = 'unhealthy';
    } else if (
        checks.redis === 'error' || 
        checks.storage === 'error'
    ) {
        // Non-critical services have issues
        status = 'degraded';
    } else {
        status = 'healthy';
    }

    const responseTime = Date.now() - requestStart;

    const response: HealthStatus = {
        status,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        checks,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        responseTime,
    };

    // Return appropriate HTTP status
    const httpStatus = status === 'unhealthy' ? 503 : status === 'degraded' ? 200 : 200;

    return NextResponse.json(response, {
        status: httpStatus,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'X-Health-Status': status,
        },
    });
}

/**
 * HEAD /api/health - Quick liveness check
 */
export async function HEAD(): Promise<NextResponse> {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'X-Health-Status': 'alive',
        },
    });
}
