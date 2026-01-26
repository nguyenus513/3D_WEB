/**
 * Featured Products API Route
 *
 * Public endpoint - returns featured products.
 *
 * @see DEVELOPMENT_GUIDE.md - Rule #1: Routes Only Route
 */

import { productController } from '@/controllers/ProductController';

/**
 * GET /api/featured-products
 * Public: Get featured products
 */
export async function GET() {
    return productController.getFeatured();
}

