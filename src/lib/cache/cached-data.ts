/**
 * Cached Data Fetchers
 *
 * Server-side cached data access layer using Next.js unstable_cache.
 * Provides revalidation tags for on-demand cache invalidation.
 */

import { unstable_cache } from 'next/cache';
import { getMongoCollections } from '@/lib/mongodb';
import type { CategoryDocument, ProductDocument } from '@/lib/mongodb';

type PublicCategory = Omit<CategoryDocument, '_id'> & { id: string };
type PublicProduct = Omit<ProductDocument, '_id'> & {
    id: string;
    is_active: boolean;
    product_variants?: unknown[];
};

function mapCategory(category: CategoryDocument): PublicCategory {
    const { _id, ...rest } = category;
    return {
        id: _id,
        ...rest,
    };
}

function mapProduct(product: ProductDocument, productVariants: unknown[] = []): PublicProduct {
    const { _id, ...rest } = product;
    const status = product.status || 'draft';

    return {
        id: _id,
        ...rest,
        status,
        is_active: status === 'active',
        product_variants: productVariants,
    };
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
        try {
            const { products } = await getMongoCollections();
            const data = await products
                .find({ status: 'active' })
                .sort({ created_at: -1 })
                .toArray();

            return data.map(product => mapProduct(product));
        } catch (error) {
            console.error('[Cache] Failed to fetch products:', error);
            return [];
        }
    },
    ['products-list'],
    {
        revalidate: 60,
        tags: ['products'],
    }
);

/**
 * Get featured products (cached for 5 minutes).
 * Invalidated by revalidateTag('products') or revalidateTag('featured').
 */
export const getCachedFeaturedProducts = unstable_cache(
    async (limit = 8) => {
        try {
            const { products } = await getMongoCollections();
            const data = await products
                .find({ status: 'active', is_featured: true })
                .sort({ created_at: -1 })
                .limit(limit)
                .toArray();

            return data.map(product => mapProduct(product));
        } catch (error) {
            console.error('[Cache] Failed to fetch featured products:', error);
            return [];
        }
    },
    ['featured-products'],
    {
        revalidate: 300,
        tags: ['products', 'featured'],
    }
);

// =============================================================================
// Cached Categories
// =============================================================================

/**
 * Get all categories (cached for 10 minutes).
 * Invalidated by revalidateTag('categories').
 */
export const getCachedCategories = unstable_cache(
    async () => {
        try {
            const { categories } = await getMongoCollections();
            const data = await categories
                .find({})
                .sort({ sort_order: 1, name: 1 })
                .toArray();

            return data.map(mapCategory);
        } catch (error) {
            console.error('[Cache] Failed to fetch categories:', error);
            return [];
        }
    },
    ['categories-list'],
    {
        revalidate: 600,
        tags: ['categories'],
    }
);
