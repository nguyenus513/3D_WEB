/**
 * Product Controller
 *
 * Request handling layer for product APIs.
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BaseController, UnauthorizedError, BadRequestError } from '@/lib/core/BaseController';
import { ProductService } from '@/services/ProductService';
import { ProductRepository } from '@/repositories/ProductRepository';
import {
    CreateProductSchema,
    UpdateProductSchema,
    ProductQuerySchema,
} from '@/validators/product.schema';
import { config } from '@/config/unifiedConfig';
import { requireAdmin } from '@/lib/security/admin-guard';

// =============================================================================
// Supabase Admin Client
// =============================================================================

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

// =============================================================================
// Product Controller
// =============================================================================

export class ProductController extends BaseController {
    private readonly productService: ProductService;

    constructor() {
        super();
        const productRepo = new ProductRepository(supabaseAdmin);
        this.productService = new ProductService(productRepo);
    }

    /**
     * GET /api/featured-products
     * Public endpoint for featured products
     */
    async getFeatured() {
        return this.wrapHandler(async () => {
            const products = await this.productService.getFeaturedProducts();
            return this.handleSuccess({ products });
        }, 'ProductController.getFeatured');
    }

    /**
     * GET /api/admin/products
     * Admin: List all products with pagination
     */
    async listProducts(request: NextRequest) {
        return this.wrapHandler(async () => {
            // Check admin access
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            // Parse query params
            const { searchParams } = new URL(request.url);
            const params = ProductQuerySchema.parse({
                page: searchParams.get('page'),
                limit: searchParams.get('limit'),
                status: searchParams.get('status'),
            });

            const result = await this.productService.listProducts(params);
            return this.handleSuccess({
                products: result.products,
                total: result.total,
            });
        }, 'ProductController.listProducts');
    }

    /**
     * POST /api/admin/products
     * Admin: Create a new product
     */
    async createProduct(request: NextRequest) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            const body = await request.json();
            const input = CreateProductSchema.parse(body);

            const product = await this.productService.createProduct(input);
            return this.handleSuccess({ product, success: true }, { status: 201 });
        }, 'ProductController.createProduct');
    }

    /**
     * PUT /api/admin/products
     * Admin: Update a product
     */
    async updateProduct(request: NextRequest) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            const body = await request.json();
            const input = UpdateProductSchema.parse(body);

            await this.productService.updateProduct(input);
            return this.handleSuccess({ success: true });
        }, 'ProductController.updateProduct');
    }

    /**
     * DELETE /api/admin/products
     * Admin: Archive a product
     */
    async deleteProduct(request: NextRequest) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            const { searchParams } = new URL(request.url);
            const id = searchParams.get('id');

            if (!id) {
                throw new BadRequestError('Product ID required');
            }

            await this.productService.archiveProduct(id);
            return this.handleSuccess({ success: true });
        }, 'ProductController.deleteProduct');
    }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const productController = new ProductController();
