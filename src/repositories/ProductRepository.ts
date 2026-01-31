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

export interface ProductSize {
    name: string;
    price: number;
    stock: number;
    enabled?: boolean;
    image_url?: string | null;
}

export interface Product {
    id: string;
    sku: string;
    name: string;
    slug: string;
    category_id?: string | null;
    type: 'ready_made' | 'custom' | 'print_on_demand';
    status: 'draft' | 'active' | 'archived';
    short_description?: string | null;
    description?: string | null;
    base_price: number;
    sale_price?: number | null;
    cost_price?: number | null;
    stock: number;
    low_stock_alert: number;
    images: ProductImage[] | string[];
    sizes: ProductSize[] | string[];
    tags: string[];
    is_featured: boolean;
    created_at: string;
    updated_at: string;
}

export interface ProductQueryParams {
    page?: number;
    limit?: number;
    status?: string;
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
        return {
            ...data,
            status: data.is_active ? 'active' : 'draft',
        };
    }

    /**
     * List products with pagination
     */
    async findAll(params: ProductQueryParams = {}): Promise<{ products: Product[]; total: number }> {
        const { page = 1, limit = 20, status } = params;
        const offset = (page - 1) * limit;

        let query = this.db
            .from('products')
            .select('*', { count: 'exact' })
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
        if (error) throw error;

        const products = (data || []).map(this.mapToProduct);
        return { products, total: count || 0 };
    }

    /**
     * Find product by ID
     */
    async findById(id: string): Promise<Product | null> {
        const { data, error } = await this.db
            .from('products')
            .select('*')
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
            .select('id, name, slug, base_price, sale_price, images, short_description, is_active')
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
}
