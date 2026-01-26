/**
 * Admin Products API Route
 *
 * Delegates all logic to ProductController.
 *
 * @see DEVELOPMENT_GUIDE.md - Rule #1: Routes Only Route
 */

import { NextRequest } from 'next/server';
import { productController } from '@/controllers/ProductController';

/**
 * GET /api/admin/products
 * List products with pagination
 */
export async function GET(request: NextRequest) {
    return productController.listProducts(request);
}

/**
 * POST /api/admin/products
 * Create a new product
 */
export async function POST(request: NextRequest) {
    return productController.createProduct(request);
}

/**
 * PUT /api/admin/products
 * Update a product
 */
export async function PUT(request: NextRequest) {
    return productController.updateProduct(request);
}

/**
 * DELETE /api/admin/products
 * Archive a product (soft delete)
 */
export async function DELETE(request: NextRequest) {
    return productController.deleteProduct(request);
}

