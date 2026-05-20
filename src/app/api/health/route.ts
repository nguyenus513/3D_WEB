import { NextResponse } from 'next/server';
import { pingMongoDb } from '@/lib/mongodb';
import { getAdminSupabase } from '@/lib/supabase/admin';

type ServiceStatus = { status: 'up' | 'down' | 'disabled'; latency?: number; db?: string };

export async function GET() {
    const services: Record<string, ServiceStatus> = {};

    try {
        const dbStart = Date.now();
        const result = await pingMongoDb();
        services.database = {
            status: result.ok === 1 ? 'up' : 'down',
            latency: Date.now() - dbStart,
            db: result.db,
        };
    } catch {
        services.database = { status: 'down', latency: 0 };
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
            const supabaseStart = Date.now();
            const supabase = getAdminSupabase();
            const { error } = await supabase.auth.getSession();
            services.supabase_legacy = {
                status: error ? 'down' : 'up',
                latency: Date.now() - supabaseStart,
            };
        } catch {
            services.supabase_legacy = { status: 'down', latency: 0 };
        }
    } else {
        services.supabase_legacy = { status: 'disabled' };
    }

    const healthy = services.database.status === 'up';

    return NextResponse.json({
        status: healthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services,
    }, {
        status: healthy ? 200 : 503,
    });
}
