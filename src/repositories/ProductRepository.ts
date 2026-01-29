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
            query = query.eq('status', status);
        }

        const { data, count, error } = await query;
        if (error) throw error;

        return { products: (data || []) as Product[], total: count || 0 };
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
        return data as Product;
    }

    /**
     * Find featured products (public)
     */
    async findFeatured(limit = 8): Promise<Product[]> {
        const { data, error } = await this.db
            .from('products')
            .select('id, name, slug, base_price, sale_price, images, short_description')
            .eq('is_featured', true)
            .eq('status', 'active')
            .order('updated_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data || []) as Product[];
    }

    /**
     * Create a new product
     */
    async create(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
        const { data: product, error } = await this.db
            .from('products')
            .insert(data)
            .select()
            .single();

        if (error) throw error;
        return product as Product;
    }

    /**
     * Update a product
     */
    async update(id: string, data: Partial<Product>): Promise<void> {
        const { error } = await this.db
            .from('products')
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
    }

    /**
     * Soft delete (archive) a product
     */
    async archive(id: string): Promise<void> {
        const { error } = await this.db
            .from('products')
            .update({ status: 'archived', updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
    }
}
