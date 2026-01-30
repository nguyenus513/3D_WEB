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
import { BaseController } from '@/lib/core/BaseController';
import { CartService } from '@/services/CartService';
import { CartRepository } from '@/repositories/CartRepository';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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
    private service: CartService | null = null;

    private async getService(): Promise<CartService> {
        if (!this.service) {
            const supabase = await createServerSupabaseClient();
            const repo = new CartRepository(supabase);
            this.service = new CartService(repo);
        }
        return this.service;
    }

    /**
     * GET /api/cart - Get user's cart
     */
    async getCart(req: NextRequest) {
        return this.handleRequest(req, async (userId) => {
            const service = await this.getService();
            const cart = await service.getCart(userId);

            if (!cart) {
                return this.success({ items: [] });
            }

            const items = service.toClientFormat(cart);
            return this.success({ items });
        });
    }

    /**
     * POST /api/cart/items - Add item to cart
     */
    async addItem(req: NextRequest) {
        return this.handleRequest(req, async (userId) => {
            const body = await req.json();
            const validated = this.validate(addItemSchema, body);

            const service = await this.getService();
            const item = await service.addItem(userId, validated);
            return this.success(item, 201);
        });
    }

    /**
     * PATCH /api/cart/items/[id] - Update item quantity
     */
    async updateItem(req: NextRequest, itemId: string) {
        return this.handleRequest(req, async (userId) => {
            const body = await req.json();
            const { quantity } = this.validate(updateQuantitySchema, body);

            const service = await this.getService();
            const item = await service.updateQuantity(userId, itemId, quantity);
            return this.success(item || { deleted: true });
        });
    }

    /**
     * DELETE /api/cart/items/[id] - Remove item from cart
     */
    async removeItem(req: NextRequest, itemId: string) {
        return this.handleRequest(req, async (userId) => {
            const service = await this.getService();
            await service.removeItem(userId, itemId);
            return this.success({ deleted: true });
        });
    }

    /**
     * DELETE /api/cart - Clear entire cart
     */
    async clearCart(req: NextRequest) {
        return this.handleRequest(req, async (userId) => {
            const service = await this.getService();
            await service.clearCart(userId);
            return this.success({ cleared: true });
        });
    }

    /**
     * POST /api/cart/sync - Sync client cart to server
     */
    async syncCart(req: NextRequest) {
        return this.handleRequest(req, async (userId) => {
            const body = await req.json();
            const { items } = this.validate(syncCartSchema, body);

            const service = await this.getService();
            const cart = await service.syncFromClient(userId, items);
            const clientItems = service.toClientFormat(cart);
            return this.success({ items: clientItems });
        });
    }
}
