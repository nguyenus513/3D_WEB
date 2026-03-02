/**
 * Public Products API (Cached)
 *
 * GET /api/public/products
 *
 * Returns all active products with HTTP caching.
 * Cache: s-maxage=60 (CDN caches for 60s), stale-while-revalidate=300
 */

import { NextResponse } from 'next/server';
import { getCachedProducts } from '@/lib/cache/cached-data';

export async function GET() {
    try {
        const products = await getCachedProducts();

        return NextResponse.json(
            { success: true, data: products },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
                },
            }
        );
    } catch (error) {
        console.error('[API/public/products] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch products' },
            { status: 500 }
        );
    }
}
