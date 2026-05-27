/**
 * Cached Data Fetchers
 *
 * Server-side cached data access layer using Next.js unstable_cache.
 * Provides revalidation tags for on-demand cache invalidation.
 */

import { unstable_cache } from 'next/cache';
import { getMongoCollections } from '@/lib/mongodb';
import type { CategoryDocument, ProductDocument, ProductVariantDocument } from '@/lib/mongodb';
import { getProductPriceInfo } from '@/lib/pricing/product-price';

type PublicCategory = Omit<CategoryDocument, '_id'> & { id: string };
type PublicVariant = Omit<ProductVariantDocument, '_id'> & { id: string; enabled: boolean };

type PublicProduct = Omit<ProductDocument, '_id'> & {
    id: string;
    is_active: boolean;
    product_variants?: PublicVariant[];
    sizes?: PublicVariant[];
    effective_price?: number | null;
    display_price_min?: number | null;
    display_price_max?: number | null;
    display_price_text?: string;
};

function mapVariant(variant: ProductVariantDocument): PublicVariant {
    const { _id, ...rest } = variant;
    return {
        id: _id,
        ...rest,
        enabled: variant.is_active !== false,
    };
}

function mapCategory(category: CategoryDocument): PublicCategory {
    const { _id, ...rest } = category;
    return {
        id: _id,
        ...rest,
    };
}

function mapProduct(product: ProductDocument, productVariants: ProductVariantDocument[] = []): PublicProduct {
    const { _id, ...rest } = product;
    const status = product.status || (product.is_active ? 'active' : 'draft');

    const publicVariants = productVariants.map(mapVariant);
    const priceInfo = getProductPriceInfo({
        base_price: product.base_price,
        sale_price: product.sale_price,
        product_variants: publicVariants,
    });

    return {
        id: _id,
        ...rest,
        status,
        is_active: product.is_active ?? status === 'active',
        product_variants: publicVariants,
        sizes: publicVariants,
        effective_price: priceInfo.effective,
        display_price_min: priceInfo.min,
        display_price_max: priceInfo.max,
        display_price_text: priceInfo.text,
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
            const { products, productVariants } = await getMongoCollections();
            const data = await products
                .find({ is_active: true, deleted_at: { $exists: false } })
                .sort({ created_at: -1 })
                .toArray();

            const productIds = data.map((product) => product._id);
            const variants = productIds.length > 0
                ? await productVariants.find({ product_id: { $in: productIds }, deleted_at: { $exists: false }, is_active: { $ne: false } }).sort({ sort_order: 1 }).toArray()
                : [];

            return data.map(product => mapProduct(product, variants.filter((variant) => variant.product_id === product._id)));
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
            const { products, productVariants } = await getMongoCollections();
            const data = await products
                .find({ is_active: true, is_featured: true, deleted_at: { $exists: false } })
                .sort({ created_at: -1 })
                .limit(limit)
                .toArray();

            const productIds = data.map((product) => product._id);
            const variants = productIds.length > 0
                ? await productVariants.find({ product_id: { $in: productIds }, deleted_at: { $exists: false }, is_active: { $ne: false } }).sort({ sort_order: 1 }).toArray()
                : [];

            return data.map(product => mapProduct(product, variants.filter((variant) => variant.product_id === product._id)));
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
                .find({ deleted_at: { $exists: false } })
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
