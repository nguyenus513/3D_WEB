import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { processQueuedEmailJobs } from '@/lib/email/emailQueue';

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.EMAIL_QUEUE_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  const token = request.nextUrl.searchParams.get('secret') || '';
  return auth === `Bearer ${secret}` || token === secret;
}

async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    const { authorized, response } = await requireAdmin(request, true);
    if (!authorized) return response;
  }

  const limit = Number(request.nextUrl.searchParams.get('limit') || 10);
  const result = await processQueuedEmailJobs(limit);
  return NextResponse.json({ success: true, ...result });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
