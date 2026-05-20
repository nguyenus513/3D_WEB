import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json({ error: 'Google Drive integration is disabled. Files are stored in Cloudflare R2.' }, { status: 410 });
}
