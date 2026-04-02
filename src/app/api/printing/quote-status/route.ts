import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getJob } from '@/lib/slicer/jobQueue';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const jobId = request.nextUrl.searchParams.get('jobId');
        if (!jobId) {
            return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
        }

        const job = getJob(jobId);
        if (!job) {
            return NextResponse.json({ error: 'Job not found', status: 'not_found' }, { status: 404 });
        }

        if (job.status === 'completed') {
            return NextResponse.json({ status: 'completed', result: job.result });
        }

        if (job.status === 'failed') {
            return NextResponse.json({ status: 'failed', error: job.error });
        }

        return NextResponse.json({ status: job.status });
    } catch (err) {
        console.error('[QuoteStatus] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
