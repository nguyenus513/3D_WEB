import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json({ error: 'Drive archive is disabled. Files remain stored in Cloudflare R2.' }, { status: 410 });
}
