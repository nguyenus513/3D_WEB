/**
 * Cart Controller
 *
 * API controller for shopping cart endpoints.
 * Extends BaseController for standardized responses.
 *
 * @see backend-dev-guidelines.md - Rule #8: Route → Controller → Service
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { BaseController, UnauthorizedError } from '@/lib/core/BaseController';
import { CartService } from '@/services/CartService';
import { CartRepository } from '@/repositories/CartRepository';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@/auth';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';

// Admin client for cart operations
const supabaseAdmin = createAdminClient(
    config.supabase.url,
    config.supabase.serviceRoleKey
);

// =============================================================================
// Validation Schemas
// =============================================================================

const addItemSchema = z.object({
    type: z.enum(['product', 'print', 'custom']),
    name: z.string().min(1),
    price: z.number().min(0),
    quantity: z.number().min(1).max(99),
    image: z.string().optional(),
    productId: z.string().uuid().optional(),
    sku: z.string().optional(),
    size: z.string().optional(),
    originalPrice: z.number().optional(),
    printOptions: z.object({
        type: z.enum(['fdm', 'resin']),
        color: z.string(),
        infill: z.string(),
        layerHeight: z.string(),
    }).optional(),
    printFiles: z.array(z.object({
        id: z.string(),
        name: z.string(),
        url: z.string().optional(),
        thumbnail: z.string().optional(),
        analysis: z.object({
            volume: z.number(),
            grams: z.number(),
            hours: z.number(),
            price: z.number(),
            boundingBox: z.object({
                x: z.number(),
                y: z.number(),
                z: z.number(),
            }).optional(),
        }).optional(),
    })).optional(),
    description: z.string().optional(),
    customFiles: z.array(z.object({
        name: z.string(),
        url: z.string(),
    })).optional(),
});

const updateQuantitySchema = z.object({
    quantity: z.number().min(0).max(99),
});

const syncCartSchema = z.object({
    items: z.array(addItemSchema.extend({ id: z.string() })),
});

// =============================================================================
// Cart Controller
// =============================================================================

export class CartController extends BaseController {
    private readonly cartService: CartService;

    constructor() {
        super();
        const repo = new CartRepository(supabaseAdmin);
        this.cartService = new CartService(repo);
    }

    /**
     * GET /api/cart - Get user's cart
     */
    async getCart(req: NextRequest) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) {
                throw new UnauthorizedError();
            }

            const cart = await this.cartService.getCart(session.user.id);

            if (!cart) {
                return this.handleSuccess({ items: [] });
            }

            const items = this.cartService.toClientFormat(cart);
            return this.handleSuccess({ items });
        }, 'CartController.getCart');
    }

    /**
     * POST /api/cart/items - Add item to cart
     */
    async addItem(req: NextRequest) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) {
                throw new UnauthorizedError();
            }

            const body = await req.json();
            const validated = addItemSchema.parse(body);

            const item = await this.cartService.addItem(session.user.id, validated);
            return this.handleSuccess(item, { status: 201 });
        }, 'CartController.addItem');
    }

    /**
     * PATCH /api/cart/items/[id] - Update item quantity
     */
    async updateItem(req: NextRequest, itemId: string) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) {
                throw new UnauthorizedError();
            }

            const body = await req.json();
            const { quantity } = updateQuantitySchema.parse(body);

            const item = await this.cartService.updateQuantity(session.user.id, itemId, quantity);
            return this.handleSuccess(item || { deleted: true });
        }, 'CartController.updateItem');
    }

    /**
     * DELETE /api/cart/items/[id] - Remove item from cart
     */
    async removeItem(req: NextRequest, itemId: string) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) {
                throw new UnauthorizedError();
            }

            await this.cartService.removeItem(session.user.id, itemId);
            return this.handleSuccess({ deleted: true });
        }, 'CartController.removeItem');
    }

    /**
     * DELETE /api/cart - Clear entire cart
     */
    async clearCart(req: NextRequest) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) {
                throw new UnauthorizedError();
            }

            await this.cartService.clearCart(session.user.id);
            return this.handleSuccess({ cleared: true });
        }, 'CartController.clearCart');
    }

    /**
     * POST /api/cart/sync - Sync client cart to server
     */
    async syncCart(req: NextRequest) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) {
                throw new UnauthorizedError();
            }

            const body = await req.json();
            const { items } = syncCartSchema.parse(body);

            const cart = await this.cartService.syncFromClient(session.user.id, items);
            const clientItems = this.cartService.toClientFormat(cart);
            return this.handleSuccess({ items: clientItems });
        }, 'CartController.syncCart');
    }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const cartController = new CartController();
