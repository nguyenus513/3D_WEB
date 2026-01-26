/**
 * Admin Orders [id] API Route
 *
 * Delegates all logic to AdminOrderController.
 *
 * @see DEVELOPMENT_GUIDE.md - Rule #1: Routes Only Route
 */

import { NextRequest } from 'next/server';
import { adminOrderController } from '@/controllers/AdminOrderController';

/**
 * GET /api/admin/orders/[id]
 * Get single order with all related data
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return adminOrderController.getOrder(request, id);
}

/**
 * PUT /api/admin/orders/[id]
 * Update order status and fields
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return adminOrderController.updateOrder(request, id);
}

