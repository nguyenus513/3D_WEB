/**
 * Product Service
 *
 * Business logic layer for products.
 */

import { ProductRepository, Product, ProductQueryParams, ProductVariant } from '@/repositories/ProductRepository';
import { NotFoundError, ConflictError } from '@/lib/core/BaseController';
import { CreateProductInput, UpdateProductInput } from '@/validators/product.schema';

// =============================================================================
// Product Service
// =============================================================================

export class ProductService {
    constructor(private readonly productRepo: ProductRepository) { }

    private getVariantSummary(variants?: { price: number; stock?: number; enabled?: boolean }[]): { minPrice: number | null; stock: number } {
        const active = (variants || []).filter((variant) => variant.enabled !== false);
        const prices = active.map((variant) => Number(variant.price)).filter((price) => Number.isFinite(price) && price > 0);
        const stock = active.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0);
        return { minPrice: prices.length > 0 ? Math.min(...prices) : null, stock };
    }

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
     * Create a new product with variants
     */
    async createProduct(input: CreateProductInput): Promise<Product> {
        try {
            const variantSummary = this.getVariantSummary(input.variants);

            // 1. Create the product (without sizes JSONB)
            const product = await this.productRepo.create({
                sku: input.sku.trim(),
                name: input.name.trim(),
                category_id: input.category_id,
                status: input.status,
                short_description: input.short_description,
                description: input.description,
                base_price: variantSummary.minPrice ?? input.base_price,
                sale_price: input.sale_price,
                stock: input.variants?.length ? variantSummary.stock : input.stock,
                images: input.images,
                tags: input.tags,
                is_featured: input.is_featured,
                is_active: input.status === 'active',
            });

            // 2. Create variants if provided
            if (input.variants && input.variants.length > 0) {
                await this.productRepo.createVariants(
                    product.id,
                    input.variants.map((v, i) => ({
                        sku: v.sku || null,
                        name: v.name,
                        price: v.price,
                        stock: v.stock || 0,
                        image_url: v.image_url || null,
                        images: v.images || [],
                        is_active: v.enabled !== false,
                        sort_order: i,
                    }))
                );

                // Re-fetch to include variants in response
                const fullProduct = await this.productRepo.findById(product.id);
                if (fullProduct) return fullProduct;
            }

            return product;
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
                throw new ConflictError('SKU đã tồn tại');
            }
            throw error;
        }
    }

    /**
     * Update a product with variants sync
     */
    async updateProduct(input: UpdateProductInput): Promise<void> {
        const { id, variants: inputVariants, ...updates } = input;

        // Check product exists
        const product = await this.productRepo.findById(id);
        if (!product) {
            throw new NotFoundError('Sản phẩm không tồn tại');
        }

        const variantSummary = inputVariants !== undefined ? this.getVariantSummary(inputVariants) : null;

        // Build update object (product fields only)
        const updateData: Partial<Product> = {};
        if (updates.name) updateData.name = updates.name.trim();
        if (updates.sku) updateData.sku = updates.sku.trim();
        if (updates.status) updateData.status = updates.status;
        if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
        if (updates.base_price !== undefined) updateData.base_price = updates.base_price;
        if (variantSummary?.minPrice !== null && variantSummary?.minPrice !== undefined) updateData.base_price = variantSummary.minPrice;
        if (variantSummary) updateData.stock = variantSummary.stock;
        if (updates.sale_price !== undefined) updateData.sale_price = updates.sale_price;
        if (updates.is_featured !== undefined) updateData.is_featured = updates.is_featured;
        if (updates.images !== undefined) updateData.images = updates.images;
        if (updates.category_id !== undefined) updateData.category_id = updates.category_id;
        if (updates.description !== undefined) updateData.description = updates.description;

        await this.productRepo.update(id, updateData);

        // Sync variants if provided
        if (inputVariants !== undefined) {
            // Replace all variants (delete + re-create)
            await this.productRepo.deleteVariantsByProduct(id);

            if (inputVariants.length > 0) {
                await this.productRepo.createVariants(
                    id,
                    inputVariants.map((v, i) => ({
                        sku: v.sku || null,
                        name: v.name,
                        price: v.price,
                        stock: v.stock || 0,
                        image_url: v.image_url || null,
                        images: v.images || [],
                        is_active: v.enabled !== false,
                        sort_order: i,
                    }))
                );
            }
        }
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
