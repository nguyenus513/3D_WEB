/**
 * Orders API Route
 *
 * Delegates all logic to OrderController.
 * Route file should be minimal - just routing.
 *
 * @see backend-dev-guidelines.md - Rule #1: Routes Only Route
 */

import { NextRequest } from 'next/server';
import { orderController } from '@/controllers/OrderController';

/**
 * GET /api/orders
 * List current user's orders
 */
export async function GET(request: NextRequest) {
    return orderController.getOrders(request);
}

/**
 * POST /api/orders
 * Create a new order
 */
export async function POST(request: NextRequest) {
    return orderController.createOrder(request);
}
