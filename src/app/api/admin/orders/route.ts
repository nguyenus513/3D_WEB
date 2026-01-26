/**
 * Admin Orders API Route
 *
 * Delegates all logic to AdminOrderController.
 *
 * @see DEVELOPMENT_GUIDE.md - Rule #1: Routes Only Route
 */

import { NextRequest } from 'next/server';
import { adminOrderController } from '@/controllers/AdminOrderController';

/**
 * GET /api/admin/orders
 * List all orders with profile data
 */
export async function GET(request: NextRequest) {
    return adminOrderController.listOrders(request);
}

