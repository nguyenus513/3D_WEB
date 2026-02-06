/**
 * Cart Merge API Route
 *
 * POST /api/cart/merge
 *
 * Called on login to merge client-side localStorage cart with server cart.
 * This supports the guest-to-user cart merge flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { CartController } from '@/controllers/CartController';

const controller = new CartController();

export async function POST(req: NextRequest) {
    return controller.syncCart(req);
}
