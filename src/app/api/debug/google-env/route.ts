import { NextResponse } from 'next/server';

// Debug route to check if Google OAuth env vars are loaded
// Access at: /api/debug/google-env
export async function GET() {
    return NextResponse.json({
        GOOGLE_CLIENT_ID_exists: !!process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_ID_preview: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...',
        GOOGLE_CLIENT_SECRET_exists: !!process.env.GOOGLE_CLIENT_SECRET,
        GOOGLE_CLIENT_SECRET_preview: process.env.GOOGLE_CLIENT_SECRET?.substring(0, 10) + '...',
        AUTH_SECRET_exists: !!process.env.AUTH_SECRET,
        AUTH_URL: process.env.AUTH_URL,
    });
}
