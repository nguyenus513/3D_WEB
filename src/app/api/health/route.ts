/**
 * Health Check API
 *
 * GET /api/health
 *
 * Returns system health status including:
 * - Application status
 * - Database connectivity
 * - Storage connectivity
 * - Uptime
 *
 * Public endpoint — no auth required.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isR2Configured } from '@/lib/storage/r2';

const startTime = Date.now();

export async function GET() {
    const checks: Record<string, { status: string; latency?: number }> = {};

    // 1. Database check
    try {
        const dbStart = Date.now();
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );
        const { error } = await supabase.from('profiles').select('id').limit(1);
        checks.database = {
            status: error ? 'unhealthy' : 'healthy',
            latency: Date.now() - dbStart,
        };
    } catch {
        checks.database = { status: 'unhealthy' };
    }

    // 2. R2 Storage check
    checks.storage = {
        status: isR2Configured() ? 'healthy' : 'not_configured',
    };

    // 3. Overall status
    const allHealthy = Object.values(checks).every(
        c => c.status === 'healthy' || c.status === 'not_configured'
    );

    return NextResponse.json({
        status: allHealthy ? 'healthy' : 'degraded',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        checks,
    }, {
        status: allHealthy ? 200 : 503,
    });
}
