import type { JobEntry, QuoteResult } from './types';

const JOB_TTL_MS = 60 * 60 * 1000;

const jobs = new Map<string, JobEntry>();

export function getJob(jobId: string): JobEntry | undefined {
    pruneOldJobs();
    return jobs.get(jobId);
}

export function createJob(jobId: string): void {
    jobs.set(jobId, { status: 'pending', createdAt: Date.now() });
    pruneOldJobs();
}

export function createCompletedJob(jobId: string, result: QuoteResult): void {
    jobs.set(jobId, { status: 'completed', result: result as JobEntry['result'], createdAt: Date.now() });
    pruneOldJobs();
}

export function enqueue(
    jobId: string,
    fn: () => Promise<QuoteResult>,
): void {
    const entry = jobs.get(jobId);
    if (!entry) return;

    jobs.set(jobId, { ...entry, status: 'running' });

    fn()
        .then((result) => {
            jobs.set(jobId, { status: 'completed', result: result as JobEntry['result'], createdAt: entry.createdAt });
        })
        .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            jobs.set(jobId, { status: 'failed', error: msg, createdAt: entry.createdAt });
            console.error(`[SlicerJob] ${jobId} failed:`, msg);
        });
}

function pruneOldJobs(): void {
    const cutoff = Date.now() - JOB_TTL_MS;
    for (const [id, entry] of jobs.entries()) {
        if (entry.createdAt < cutoff) jobs.delete(id);
    }
}
