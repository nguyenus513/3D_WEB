import { getMongoDb } from '@/lib/mongodb/client';
import { sendEmailWithFallback, type EmailOptions } from '@/lib/email/sendEmail';

type EmailJobStatus = 'queued' | 'sending' | 'sent' | 'failed';

export interface EmailJobInput extends EmailOptions {
  orderId?: string;
  orderCode?: string;
  status?: string;
  recipientName?: string;
  source?: string;
}

interface EmailJobDocument extends EmailJobInput {
  _id?: unknown;
  key: string;
  recipient: string;
  attempts: number;
  job_status: EmailJobStatus;
  last_error?: string | null;
  sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

function makeJobKey(input: EmailJobInput): string {
  const orderPart = input.orderId || input.orderCode || 'manual';
  const statusPart = input.status || input.subject;
  return `${orderPart}:${statusPart}:${input.to}`.toLowerCase();
}

function shouldRetry(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || error || '').toLowerCase();
  return message.includes('timeout') || message.includes('greeting never received') || message.includes('network') || message.includes('econn');
}

async function ensureEmailJobIndexes() {
  const db = await getMongoDb();
  const collection = db.collection<EmailJobDocument>('email_jobs');
  await Promise.all([
    collection.createIndex({ key: 1 }, { unique: true, name: 'email_jobs_key_unique' }),
    collection.createIndex({ job_status: 1, attempts: 1, created_at: 1 }, { name: 'email_jobs_status_attempts_created_idx' }),
    collection.createIndex({ orderId: 1, status: 1, recipient: 1 }, { name: 'email_jobs_order_status_recipient_idx' }),
  ]);
}

export async function enqueueEmailJob(input: EmailJobInput): Promise<{ queued: boolean; key?: string; sent?: boolean }> {
  if (!input.to || !input.subject || !input.html) {
    console.warn('[EmailQueue] skipped invalid job', { to: input.to, subject: input.subject, orderId: input.orderId, status: input.status });
    return { queued: false };
  }

  await ensureEmailJobIndexes();
  const db = await getMongoDb();
  const collection = db.collection<EmailJobDocument>('email_jobs');
  const now = new Date().toISOString();
  const key = makeJobKey(input);
  const recipient = input.to;

  const result = await collection.findOneAndUpdate(
    { key },
    {
      $setOnInsert: {
        ...input,
        key,
        recipient,
        attempts: 0,
        job_status: 'queued',
        last_error: null,
        sent_at: null,
        created_at: now,
      },
      $set: { updated_at: now },
    },
    { upsert: true, returnDocument: 'after' },
  );

  const job = result as EmailJobDocument | null;
  if (job?.sent_at || job?.job_status === 'sent') {
    console.log('[EmailQueue] already sent', { key, recipient });
    return { queued: true, key, sent: true };
  }

  const sent = await processEmailJob(key);
  return { queued: true, key, sent };
}

export async function processEmailJob(key: string): Promise<boolean> {
  const db = await getMongoDb();
  const collection = db.collection<EmailJobDocument>('email_jobs');
  const maxAttempts = 3;
  const now = new Date().toISOString();

  const job = await collection.findOneAndUpdate(
    { key, job_status: { $ne: 'sent' }, attempts: { $lt: maxAttempts } },
    { $set: { job_status: 'sending', updated_at: now }, $inc: { attempts: 1 } },
    { returnDocument: 'after' },
  ) as EmailJobDocument | null;

  if (!job) return false;

  try {
    const success = await sendEmailWithFallback({ to: job.to, subject: job.subject, html: job.html });
    if (success) {
      await collection.updateOne(
        { key },
        { $set: { job_status: 'sent', sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() } },
      );
      console.log('[EmailQueue] sent', { key, recipient: job.recipient, attempts: job.attempts });
      return true;
    }
    throw new Error('EMAIL_PROVIDER_FAILED');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const nextAttempts = Number(job.attempts || 1);
    const final = nextAttempts >= maxAttempts;
    await collection.updateOne(
      { key },
      { $set: { job_status: final ? 'failed' : 'queued', last_error: message, updated_at: new Date().toISOString() } },
    );
    console.warn('[EmailQueue] send failed', { key, attempts: nextAttempts, final, message });
    return false;
  }
}

export async function processQueuedEmailJobs(limit = 10): Promise<{ processed: number; sent: number; failed: number }> {
  await ensureEmailJobIndexes();
  const db = await getMongoDb();
  const collection = db.collection<EmailJobDocument>('email_jobs');
  const jobs = await collection
    .find({ job_status: { $in: ['queued', 'failed'] }, attempts: { $lt: 3 } })
    .sort({ created_at: 1 })
    .limit(Math.max(1, Math.min(limit, 50)))
    .toArray();

  let sent = 0;
  let failed = 0;
  for (const job of jobs) {
    const ok = await processEmailJob(job.key);
    if (ok) sent += 1;
    else failed += 1;
  }

  return { processed: jobs.length, sent, failed };
}

