import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin;
    const next = requestUrl.searchParams.get('next') || '/account';
    return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/account'}`);
}
