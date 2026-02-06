import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { archiveOrderFilesToDrive } from '@/lib/storage/archive-order';

export async function POST(request: NextRequest) {
    try {
        const secret = process.env.ARCHIVE_JOB_SECRET;
        if (!secret) {
            return NextResponse.json({ error: 'Archive secret not configured' }, { status: 500 });
        }

        const provided = request.headers.get('x-archive-secret');
        if (provided !== secret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const delayMinutes = Number(process.env.ARCHIVE_DELAY_MINUTES || 2);
        const cutoff = new Date(Date.now() - delayMinutes * 60 * 1000).toISOString();

        const supabase = getAdminSupabase();
        const { data: orders, error } = await supabase
            .from('orders')
            .select('id, order_code')
            .in('status', ['completed', 'delivered'])
            .is('archived_at', null)
            .or(`completed_at.lte.${cutoff},delivered_at.lte.${cutoff}`);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const results: Record<string, unknown>[] = [];
        for (const order of orders || []) {
            const res = await archiveOrderFilesToDrive(order.id);
            results.push({ order_id: order.id, order_code: order.order_code, ...res });
        }

        return NextResponse.json({
            success: true,
            count: results.length,
            results,
        });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
