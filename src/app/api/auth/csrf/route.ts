/**
 * CSRF Token Endpoint
 * 
 * GET /api/auth/csrf
 * 
 * Returns a CSRF token for client-side use.
 * Also sets the token in an HttpOnly cookie.
 */

import { NextResponse } from 'next/server';
import { getCsrfTokenForClient, CSRF_CONFIG } from '@/lib/security/csrf';

export async function GET() {
    const token = await getCsrfTokenForClient();
    
    return NextResponse.json({
        token,
        headerName: CSRF_CONFIG.headerName,
    }, {
        headers: {
            'Cache-Control': 'no-store, max-age=0',
        },
    });
}
