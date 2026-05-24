import { NextResponse } from 'next/server';
import { pingMongoDb } from '@/lib/mongodb';

type ServiceStatus = { status: 'up' | 'down'; latency?: number; db?: string };

export async function GET() {
    const services: Record<string, ServiceStatus> = {};

    try {
        const dbStart = Date.now();
        const result = await pingMongoDb();
        services.mongodb = {
            status: result.ok === 1 ? 'up' : 'down',
            latency: Date.now() - dbStart,
            db: result.db,
        };
    } catch {
        services.mongodb = { status: 'down', latency: 0 };
    }

    const healthy = services.mongodb.status === 'up';

    return NextResponse.json({
        status: healthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services,
    }, {
        status: healthy ? 200 : 503,
    });
}
