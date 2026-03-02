/**
 * Public Categories API (Cached)
 *
 * GET /api/public/categories
 *
 * Returns all categories with HTTP caching.
 * Cache: s-maxage=600 (CDN caches for 10 minutes), stale-while-revalidate=3600
 */

import { NextResponse } from 'next/server';
import { getCachedCategories } from '@/lib/cache/cached-data';

export async function GET() {
    try {
        const categories = await getCachedCategories();

        return NextResponse.json(
            { success: true, data: categories },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
                },
            }
        );
    } catch (error) {
        console.error('[API/public/categories] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch categories' },
            { status: 500 }
        );
    }
}
