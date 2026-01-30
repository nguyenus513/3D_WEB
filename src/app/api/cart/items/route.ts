/**
 * Cart Items API Route
 * 
 * POST /api/cart/items - Add item to cart
 */

import { NextRequest } from 'next/server';
import { CartController } from '@/controllers/CartController';

const controller = new CartController();

export async function POST(req: NextRequest) {
    return controller.addItem(req);
}
