import { NextRequest } from 'next/server';
import { adminOrderController } from '@/controllers/AdminOrderController';

/**
 * PUT /api/admin/orders/[id]/update
 * Update order status and notes
 * Delegates to AdminOrderController for multi-table support
 */
export async function PUT(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    return adminOrderController.updateOrder(request, params.id);
}
