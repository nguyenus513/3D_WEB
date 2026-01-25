/**
 * NextAuth API Route Handler
 * This handles all /api/auth/* routes
 */

import { handlers } from '@/auth';
import { NextRequest } from 'next/server';

// Debug wrapper to log all NextAuth requests
export async function GET(request: NextRequest) {
    console.log('[NEXTAUTH DEBUG] GET request:', request.nextUrl.pathname);
    return handlers.GET(request);
}

export async function POST(request: NextRequest) {
    console.log('[NEXTAUTH DEBUG] POST request:', request.nextUrl.pathname);
    // Log body for debugging (careful - don't log passwords in production!)
    try {
        const clonedReq = request.clone();
        const body = await clonedReq.text();
        console.log('[NEXTAUTH DEBUG] POST body keys:', body ? Object.keys(JSON.parse(body) || {}).join(', ') : 'empty or formdata');
    } catch {
        console.log('[NEXTAUTH DEBUG] POST body: FormData or unparseable');
    }
    return handlers.POST(request);
}
