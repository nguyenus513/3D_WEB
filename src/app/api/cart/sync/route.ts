/**
 * Cart Sync API Route
 * 
 * POST /api/cart/sync - Sync client localStorage cart to server
 * Called after user logs in to merge guest cart with user cart
 */

import { NextRequest } from 'next/server';
import { CartController } from '@/controllers/CartController';

const controller = new CartController();

export async function POST(req: NextRequest) {
    return controller.syncCart(req);
}
