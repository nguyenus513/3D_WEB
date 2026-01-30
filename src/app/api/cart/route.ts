/**
 * Cart API Routes
 * 
 * GET  /api/cart         - Get user's cart
 * POST /api/cart/sync    - Sync client cart to server
 * DELETE /api/cart       - Clear entire cart
 */

import { NextRequest } from 'next/server';
import { CartController } from '@/controllers/CartController';

const controller = new CartController();

export async function GET(req: NextRequest) {
    return controller.getCart(req);
}

export async function DELETE(req: NextRequest) {
    return controller.clearCart(req);
}
