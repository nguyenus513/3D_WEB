import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ connected: false, disabled: true, storage: 'r2' });
}

export async function DELETE() {
    return NextResponse.json({ success: true, disabled: true });
}
