import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://provinces.open-api.vn/api/v1';

export async function GET(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
    const { path = [] } = await params;
    const upstreamPath = path.map(encodeURIComponent).join('/');
    const needsTrailingSlash = path.length === 1 && (path[0] === 'p' || path[0] === 'd');
    const url = new URL(`${API_BASE}/${upstreamPath}${needsTrailingSlash ? '/' : ''}`);
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));

    try {
        const response = await fetch(url, { next: { revalidate: 86400 } });
        const data = await response.text();
        return new NextResponse(data, {
            status: response.status,
            headers: {
                'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
                'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800',
            },
        });
    } catch (error) {
        console.error('[GeoProxy] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch geography data' }, { status: 502 });
    }
}
