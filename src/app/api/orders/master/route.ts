import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json(
        { error: 'Legacy master order API is disabled. Use canonical order APIs.' },
        { status: 410 },
    );
}

export async function GET() {
    return NextResponse.json(
        { error: 'Legacy master order API is disabled. Use canonical order APIs.' },
        { status: 410 },
    );
}

