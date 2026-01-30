/**
 * Cart Item API Route
 * 
 * PATCH  /api/cart/items/[id] - Update item quantity
 * DELETE /api/cart/items/[id] - Remove item from cart
 */

import { NextRequest } from 'next/server';
import { CartController } from '@/controllers/CartController';

const controller = new CartController();

interface Params {
    params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return controller.updateItem(req, id);
}

export async function DELETE(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return controller.removeItem(req, id);
}
