import { NextResponse } from 'next/server';
import { getCsrfTokenForClient } from '@/lib/security/csrf';

export async function GET() {
    const token = await getCsrfTokenForClient();
    return NextResponse.json(
        { token },
        { headers: { 'Cache-Control': 'no-store' } }
    );
}
