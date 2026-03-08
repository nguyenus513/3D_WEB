import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';

export async function GET() {
    const services: Record<string, { status: 'up' | 'down'; latency?: number }> = {};

    try {
        const dbStart = Date.now();
        const supabase = getAdminSupabase();
        const { error } = await supabase.from('users').select('id').limit(1);
        services.database = {
            status: error ? 'down' : 'up',
            latency: Date.now() - dbStart,
        };
    } catch {
        services.database = { status: 'down', latency: 0 };
    }

    try {
        const supabaseStart = Date.now();
        const supabase = getAdminSupabase();
        const { error } = await supabase.auth.getSession();
        services.supabase = {
            status: error ? 'down' : 'up',
            latency: Date.now() - supabaseStart,
        };
    } catch {
        services.supabase = { status: 'down', latency: 0 };
    }

    const allUp = Object.values(services).every(s => s.status === 'up');

    return NextResponse.json({
        status: allUp ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services,
    }, {
        status: allUp ? 200 : 503,
    });
}
