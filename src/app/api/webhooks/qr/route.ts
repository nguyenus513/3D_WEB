import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json(
        { error: 'Legacy QR webhook is disabled. Use canonical PayOS webhook.' },
        { status: 410 },
    );
}

export async function GET() {
    return NextResponse.json(
        { error: 'Legacy QR webhook is disabled. Use canonical PayOS webhook.' },
        { status: 410 },
    );
}

