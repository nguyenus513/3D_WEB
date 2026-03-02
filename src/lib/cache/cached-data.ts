/**
 * Cached Data Fetchers
 *
 * Server-side cached data access layer using Next.js unstable_cache.
 * Provides revalidation tags for on-demand cache invalidation.
 *
 * Usage (in Server Components or API Routes):
 *   import { getCachedProducts, getCachedCategories } from '@/lib/cache/cached-data';
 *
 * Cache invalidation (after admin creates/updates product):
 *   import { revalidateTag } from 'next/cache';
 *   revalidateTag('products');
 */

import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';

// =============================================================================
// Supabase Admin (server-side only)
// =============================================================================

function getSupabaseAdmin() {
    return createClient(
        config.supabase.url,
        config.supabase.serviceRoleKey,
        { auth: { persistSession: false } }
    );
}

// =============================================================================
// Cached Products
// =============================================================================

/**
 * Get all active products (cached for 60 seconds).
 * Invalidated by revalidateTag('products').
 */
export const getCachedProducts = unstable_cache(
    async () => {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('products')
            .select('*, product_variants(*)')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Cache] Failed to fetch products:', error);
            return [];
        }

        return data || [];
    },
    ['products-list'],
    {
        revalidate: 60, // Revalidate every 60 seconds
        tags: ['products'],
    }
);

/**
 * Get featured products (cached for 5 minutes).
 * Invalidated by revalidateTag('products') or revalidateTag('featured').
 */
export const getCachedFeaturedProducts = unstable_cache(
    async (limit = 8) => {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('products')
            .select('*, product_variants(*)')
            .eq('is_active', true)
            .eq('is_featured', true)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[Cache] Failed to fetch featured products:', error);
            return [];
        }

        return data || [];
    },
    ['featured-products'],
    {
        revalidate: 300, // 5 minutes
        tags: ['products', 'featured'],
    }
);

// =============================================================================
// Cached Categories
// =============================================================================

/**
 * Get all categories (cached for 10 minutes).
 * Categories rarely change — long cache is safe.
 * Invalidated by revalidateTag('categories').
 */
export const getCachedCategories = unstable_cache(
    async () => {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('[Cache] Failed to fetch categories:', error);
            return [];
        }

        return data || [];
    },
    ['categories-list'],
    {
        revalidate: 600, // 10 minutes
        tags: ['categories'],
    }
);
