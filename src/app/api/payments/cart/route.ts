import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json(
        { error: 'Legacy cart payment API is disabled. Use canonical PayOS/payment APIs.' },
        { status: 410 },
    );
}

