/**
 * Product Controller
 *
 * Request handling layer for product APIs.
 */

import { NextRequest } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { BaseController, UnauthorizedError, BadRequestError } from '@/lib/core/BaseController';
import { ProductService } from '@/services/ProductService';
import { ProductRepository } from '@/repositories/ProductRepository';
import {
    CreateProductSchema,
    UpdateProductSchema,
    ProductQuerySchema,
} from '@/validators/product.schema';
import { requireAdmin } from '@/lib/security/admin-guard';
import { revalidateTag } from 'next/cache';

// =============================================================================
// Supabase Admin Client
// =============================================================================

const supabaseAdmin = getAdminSupabase();

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
            const { authorized, response: authResponse } = await requireAdmin(request);
            if (!authorized) return authResponse as any;

            // Parse query params
            const { searchParams } = new URL(request.url);
            const params = ProductQuerySchema.parse({
                page: searchParams.get('page'),
                limit: searchParams.get('limit'),
                status: searchParams.get('status'),
            });

            console.log('[ProductController] List params:', params);
            const result = await this.productService.listProducts(params);
            console.log('[ProductController] Found products:', result.total, 'items');

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
            const { authorized, response: authResponse } = await requireAdmin(request);
            if (!authorized) return authResponse as any;

            const body = await request.json();
            console.log('[ProductController] Create product body:', JSON.stringify(body, null, 2));

            const parseResult = CreateProductSchema.safeParse(body);
            if (!parseResult.success) {
                console.error('[ProductController] Validation failed:', parseResult.error.issues);
                throw new BadRequestError(`Validation failed: ${JSON.stringify(parseResult.error.issues)}`);
            }
            const input = parseResult.data;

            const product = await this.productService.createProduct(input);

            // Invalidate cached product lists
            revalidateTag('products');

            return this.handleSuccess({ product, success: true }, { status: 201 });
        }, 'ProductController.createProduct');
    }

    /**
     * PUT /api/admin/products
     * Admin: Update a product
     */
    async updateProduct(request: NextRequest) {
        return this.wrapHandler(async () => {
            const { authorized, response: authResponse } = await requireAdmin(request);
            if (!authorized) return authResponse as any;

            const body = await request.json();
            const input = UpdateProductSchema.parse(body);

            await this.productService.updateProduct(input);

            // Invalidate cached product lists
            revalidateTag('products');

            return this.handleSuccess({ success: true });
        }, 'ProductController.updateProduct');
    }

    /**
     * DELETE /api/admin/products
     * Admin: Archive a product
     */
    async deleteProduct(request: NextRequest) {
        return this.wrapHandler(async () => {
            const { authorized, response: authResponse } = await requireAdmin(request);
            if (!authorized) return authResponse as any;

            const { searchParams } = new URL(request.url);
            const id = searchParams.get('id');

            if (!id) {
                throw new BadRequestError('Product ID required');
            }

            await this.productService.archiveProduct(id);

            // Invalidate cached product lists
            revalidateTag('products');

            return this.handleSuccess({ success: true });
        }, 'ProductController.deleteProduct');
    }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const productController = new ProductController();

