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
        // Generate slug if not provided
        const slug = input.slug || this.generateSlug(input.name);

        try {
            return await this.productRepo.create({
                sku: input.sku.trim(),
                name: input.name.trim(),
                slug,
                category_id: input.category_id,
                type: input.type,
                status: input.status,
                short_description: input.short_description,
                description: input.description,
                base_price: input.base_price,
                sale_price: input.sale_price,
                cost_price: input.cost_price,
                stock: input.stock,
                low_stock_alert: input.low_stock_alert,
                images: input.images,
                sizes: input.sizes,
                tags: input.tags,
                is_featured: input.is_featured,
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
        if (updates.slug) updateData.slug = updates.slug.trim();
        if (updates.status) updateData.status = updates.status;
        if (updates.base_price !== undefined) updateData.base_price = updates.base_price;
        if (updates.sale_price !== undefined) updateData.sale_price = updates.sale_price;
        if (updates.stock !== undefined) updateData.stock = updates.stock;
        if (updates.is_featured !== undefined) updateData.is_featured = updates.is_featured;
        if (updates.images !== undefined) updateData.images = updates.images;
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
