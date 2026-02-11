/**
 * Product Service
 *
 * Business logic layer for products.
 */

import { ProductRepository, Product, ProductQueryParams } from '@/repositories/ProductRepository';
import { NotFoundError, ConflictError } from '@/lib/core/BaseController';
import { CreateProductInput, UpdateProductInput } from '@/validators/product.schema';

// =============================================================================
// Product Service
// =============================================================================

export class ProductService {
    constructor(private readonly productRepo: ProductRepository) { }

    /**
     * List products with pagination
     */
    async listProducts(params: ProductQueryParams): Promise<{ products: Product[]; total: number }> {
        return this.productRepo.findAll(params);
    }

    /**
     * Get featured products (public)
     */
    async getFeaturedProducts(limit = 8): Promise<Product[]> {
        return this.productRepo.findFeatured(limit);
    }

    /**
     * Get single product by ID
     */
    async getProductById(id: string): Promise<Product> {
        const product = await this.productRepo.findById(id);
        if (!product) {
            throw new NotFoundError('Sản phẩm không tồn tại');
        }
        return product;
    }

    /**
     * Create a new product
     */
    async createProduct(input: CreateProductInput): Promise<Product> {
        // Note: slug removed from DB - no longer needed

        try {
            return await this.productRepo.create({
                sku: input.sku.trim(),
                name: input.name.trim(),
                // Note: 'slug' removed - column doesn't exist in DB
                category_id: input.category_id,
                // Note: 'type' removed - column doesn't exist in DB
                status: input.status,
                short_description: input.short_description,
                description: input.description,
                base_price: input.base_price,
                sale_price: input.sale_price,
                // Note: 'cost_price' removed - column doesn't exist in DB
                stock: input.stock,
                images: input.images,
                sizes: input.sizes, // JSONB column in DB
                tags: input.tags,
                is_featured: input.is_featured,
                is_active: input.status === 'active',
            });
        } catch (error: unknown) {


            if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
                throw new ConflictError('SKU hoặc slug đã tồn tại');
            }
            throw error;
        }
    }

    /**
     * Update a product
     */
    async updateProduct(input: UpdateProductInput): Promise<void> {
        const { id, ...updates } = input;

        // Check product exists
        const product = await this.productRepo.findById(id);
        if (!product) {
            throw new NotFoundError('Sản phẩm không tồn tại');
        }

        // Build update object
        const updateData: Partial<Product> = {};
        if (updates.name) updateData.name = updates.name.trim();
        if (updates.sku) updateData.sku = updates.sku.trim();
        // Note: slug removed from DB
        if (updates.status) updateData.status = updates.status;
        if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
        if (updates.base_price !== undefined) updateData.base_price = updates.base_price;
        if (updates.sale_price !== undefined) updateData.sale_price = updates.sale_price;
        if (updates.stock !== undefined) updateData.stock = updates.stock;
        if (updates.is_featured !== undefined) updateData.is_featured = updates.is_featured;
        if (updates.images !== undefined) updateData.images = updates.images;
        if (updates.sizes !== undefined) updateData.sizes = updates.sizes;
        if (updates.description !== undefined) updateData.description = updates.description;

        await this.productRepo.update(id, updateData);
    }

    /**
     * Archive (soft delete) a product
     */
    async archiveProduct(id: string): Promise<void> {
        const product = await this.productRepo.findById(id);
        if (!product) {
            throw new NotFoundError('Sản phẩm không tồn tại');
        }
        await this.productRepo.archive(id);
    }

    // ==========================================================================
    // Private Helpers
    // ==========================================================================

    private generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 150);
    }
}
