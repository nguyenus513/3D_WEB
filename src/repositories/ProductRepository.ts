/**
 * Product Repository
 *
 * Data access layer for products table.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// Types
// =============================================================================

export interface ProductImage {
    url: string;
    is_main?: boolean;
}

/** @deprecated Use ProductVariant instead */
export interface ProductSize {
    sku?: string;
    name: string;
    price: number;
    stock: number;
    enabled?: boolean;
    image_url?: string | null;
}

export interface ProductVariant {
    id: string;
    product_id: string;
    sku: string | null;
    name: string;
    price: number;
    stock: number;
    image_url: string | null;
    images: string[];
    is_active: boolean;
    sort_order: number;
    created_at?: string;
    updated_at?: string;
}

export interface Product {
    id: string;
    sku: string;
    name: string;
    // Note: 'slug' column removed from DB
    category_id?: string | null;
    category?: { id: string; name: string } | null; // Joined relation
    // Note: 'type' column doesn't exist in DB - removed
    short_description?: string | null;
    description?: string | null;
    base_price: number;
    sale_price?: number | null;
    // Note: 'cost_price' doesn't exist in DB - removed
    stock: number;
    images: ProductImage[] | string[];
    /** @deprecated Use variants instead */
    sizes?: ProductSize[] | null;
    variants?: ProductVariant[];
    specs?: Record<string, unknown> | null;
    tags: string[];
    is_featured: boolean;
    is_active: boolean;
    view_count?: number;
    sold_count?: number;
    low_stock_alert?: number;
    created_at: string;
    updated_at: string;
    // Virtual field for UI - mapped from is_active
    status?: 'draft' | 'active' | 'archived';
}

export interface ProductQueryParams {
    page?: number;
    limit?: number;
    status?: string | null;
}

// =============================================================================
// Product Repository
// =============================================================================

export class ProductRepository {
    constructor(private readonly db: SupabaseClient) { }

    /**
     * Map DB result to Product type
     */
    private mapToProduct(data: any): Product {
        if (!data) return data;
        // Extract variants from joined data if present
        const { product_variants, ...rest } = data;
        return {
            ...rest,
            status: data.is_active ? 'active' : 'draft',
            variants: product_variants || undefined,
        };
    }

    /**
     * List products with pagination
     */
    async findAll(params: ProductQueryParams = {}): Promise<{ products: Product[]; total: number }> {
        const { page = 1, limit = 20, status } = params;
        const offset = (page - 1) * limit;

        console.log('[ProductRepository.findAll] Starting query with params:', { page, limit, status, offset });

        let query = this.db
            .from('products')
            .select('*, category:categories(id, name), product_variants(*)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            // Map status filter to is_active
            if (status === 'active') {
                query = query.eq('is_active', true);
            } else if (status === 'draft' || status === 'archived') {
                query = query.eq('is_active', false);
            }
        }

        const { data, count, error } = await query;

        console.log('[ProductRepository.findAll] Query result:', {
            dataCount: data?.length || 0,
            total: count,
            error: error?.message,
            firstProduct: data?.[0]?.name
        });

        if (error) {
            console.error('[ProductRepository.findAll] Error:', error);
            throw error;
        }

        const products = (data || []).map(this.mapToProduct);
        return { products, total: count || 0 };
    }

    /**
     * Find product by ID
     */
    async findById(id: string): Promise<Product | null> {
        const { data, error } = await this.db
            .from('products')
            .select('*, product_variants(*)')
            .eq('id', id)
            .single();

        if (error?.code === 'PGRST116') return null;
        if (error) throw error;
        return this.mapToProduct(data);
    }

    /**
     * Find featured products (public)
     */
    async findFeatured(limit = 8): Promise<Product[]> {
        const { data, error } = await this.db
            .from('products')
            .select('id, name, sku, base_price, sale_price, images, short_description, is_active')
            .eq('is_featured', true)
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data || []).map(this.mapToProduct);
    }

    /**
     * Create a new product
     */
    async create(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
        // Map status to is_active
        const { status, ...rest } = data;
        const dbPayload = {
            ...rest,
            is_active: status === 'active'
        };

        const { data: product, error } = await this.db
            .from('products')
            .insert(dbPayload)
            .select()
            .single();

        if (error) throw error;
        return this.mapToProduct(product);
    }

    /**
     * Update a product
     */
    async update(id: string, data: Partial<Product>): Promise<void> {
        // Map status to is_active
        const { status, ...rest } = data;
        const dbPayload: any = { ...rest, updated_at: new Date().toISOString() };

        if (status !== undefined) {
            dbPayload.is_active = status === 'active';
        }

        const { error } = await this.db
            .from('products')
            .update(dbPayload)
            .eq('id', id);

        if (error) throw error;
    }

    /**
     * Soft delete (archive) a product
     */
    async archive(id: string): Promise<void> {
        const { error } = await this.db
            .from('products')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
    }

    // =========================================================================
    // Variant Operations
    // =========================================================================

    /**
     * Get variants for a product
     */
    async findVariants(productId: string): Promise<ProductVariant[]> {
        const { data, error } = await this.db
            .from('product_variants')
            .select('*')
            .eq('product_id', productId)
            .order('sort_order', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    /**
     * Bulk create variants for a product
     */
    async createVariants(
        productId: string,
        variants: Omit<ProductVariant, 'id' | 'product_id' | 'created_at' | 'updated_at'>[]
    ): Promise<ProductVariant[]> {
        if (variants.length === 0) return [];

        const rows = variants.map((v, i) => ({
            product_id: productId,
            sku: v.sku,
            name: v.name,
            price: v.price,
            stock: v.stock,
            image_url: v.image_url,
            images: v.images || [],
            is_active: v.is_active ?? true,
            sort_order: v.sort_order ?? i,
        }));

        const { data, error } = await this.db
            .from('product_variants')
            .insert(rows)
            .select();

        if (error) throw error;
        return data || [];
    }

    /**
     * Update a single variant
     */
    async updateVariant(id: string, data: Partial<ProductVariant>): Promise<void> {
        const { id: _, product_id: __, created_at: ___, ...updates } = data;
        const { error } = await this.db
            .from('product_variants')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
    }

    /**
     * Delete a variant
     */
    async deleteVariant(id: string): Promise<void> {
        const { error } = await this.db
            .from('product_variants')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    /**
     * Delete all variants for a product
     */
    async deleteVariantsByProduct(productId: string): Promise<void> {
        const { error } = await this.db
            .from('product_variants')
            .delete()
            .eq('product_id', productId);

        if (error) throw error;
    }

    /**
     * Atomic stock deduction for a variant
     */
    async deductVariantStock(variantId: string, quantity: number): Promise<void> {
        const { error } = await this.db.rpc('deduct_variant_stock', {
            p_variant_id: variantId,
            p_quantity: quantity,
        });

        if (error) throw error;
    }
}
