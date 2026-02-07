/**
 * Cart Service
 *
 * Business logic layer for shopping cart.
 * Handles cart operations, sync, and validation.
 *
 * @see backend-dev-guidelines.md - Rule #5: Use Service Layer for Business Logic
 */

import { CartRepository, CartWithItems, CartItemDB } from '@/repositories/CartRepository';
import { CartItem as ClientCartItem } from '@/lib/store/cart';
import { BadRequestError, NotFoundError } from '@/lib/core/BaseController';

// =============================================================================
// Constants
// =============================================================================

const MAX_QUANTITY_PER_ITEM = 99;
const MAX_ITEMS_PER_CART = 50;

// =============================================================================
// Cart Service
// =============================================================================

export class CartService {
    constructor(private readonly cartRepo: CartRepository) { }

    /**
     * Get user's cart with all items
     */
    async getCart(userId: string): Promise<CartWithItems | null> {
        return this.cartRepo.getCartWithItems(userId);
    }

    /**
     * Add item to cart
     */
    async addItem(
        userId: string,
        item: Omit<ClientCartItem, 'id'>
    ): Promise<CartItemDB> {
        // Validate
        this.validateItem(item);

        const cart = await this.cartRepo.getOrCreateCart(userId);
        const existingCart = await this.cartRepo.getCartWithItems(userId);
        const itemCount = existingCart?.order_items.length || 0;

        if (itemCount >= MAX_ITEMS_PER_CART) {
            throw new BadRequestError(`Giỏ hàng tối đa ${MAX_ITEMS_PER_CART} sản phẩm`);
        }

        // For products, check if same product+size exists
        if (item.type === 'product' && item.productId) {
            const existing = await this.cartRepo.findProductItem(
                cart.id,
                item.productId,
                item.size
            );

            if (existing) {
                const newQty = Math.min(
                    existing.quantity + item.quantity,
                    MAX_QUANTITY_PER_ITEM
                );
                return this.cartRepo.updateItemQuantity(existing.id, cart.id, newQty);
            }
        }

        return this.cartRepo.addItem(cart.id, cart.cart_code, item);
    }

    /**
     * Update item quantity
     */
    async updateQuantity(
        userId: string,
        itemId: string,
        quantity: number
    ): Promise<CartItemDB | null> {
        if (quantity <= 0) {
            await this.removeItem(userId, itemId);
            return null;
        }

        if (quantity > MAX_QUANTITY_PER_ITEM) {
            throw new BadRequestError(`Số lượng tối đa là ${MAX_QUANTITY_PER_ITEM}`);
        }

        const cart = await this.cartRepo.getOrCreateCart(userId);
        return this.cartRepo.updateItemQuantity(itemId, cart.id, quantity);
    }

    /**
     * Remove item from cart
     */
    async removeItem(userId: string, itemId: string): Promise<void> {
        const cart = await this.cartRepo.getOrCreateCart(userId);
        await this.cartRepo.removeItem(itemId, cart.id);
    }

    /**
     * Clear all items from cart
     */
    async clearCart(userId: string): Promise<void> {
        const cart = await this.cartRepo.getOrCreateCart(userId);
        await this.cartRepo.clearCart(cart.id);
    }

    /**
     * Sync client cart to server (for login transition)
     * Merges guest cart with existing user cart
     */
    async syncFromClient(
        userId: string,
        clientItems: ClientCartItem[]
    ): Promise<CartWithItems> {
        // Validate all items
        clientItems.forEach((item) => this.validateItem(item));

        return this.cartRepo.syncFromClient(userId, clientItems);
    }

    /**
     * Convert server cart to client format
     */
    toClientFormat(serverCart: CartWithItems): ClientCartItem[] {
        return serverCart.order_items.map((item) => ({
            id: item.id,
            type: item.item_type,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image_url,
            productId: item.product_id,
            sku: item.product_sku,
            size: item.size,
            originalPrice: item.original_price,
            printOptions: item.print_options,
            printFiles: item.print_files,
            description: item.description,
            customFiles: item.custom_files,
        }));
    }

    // ==========================================================================
    // Private Helpers
    // ==========================================================================

    private validateItem(item: Omit<ClientCartItem, 'id'>): void {
        if (!item.name?.trim()) {
            throw new BadRequestError('Tên sản phẩm là bắt buộc');
        }

        if (item.price < 0) {
            throw new BadRequestError('Giá không hợp lệ');
        }

        if (item.quantity <= 0) {
            throw new BadRequestError('Số lượng phải lớn hơn 0');
        }

        if (item.quantity > MAX_QUANTITY_PER_ITEM) {
            throw new BadRequestError(`Số lượng tối đa là ${MAX_QUANTITY_PER_ITEM}`);
        }

        if (!['product', 'print', 'custom'].includes(item.type)) {
            throw new BadRequestError('Loại sản phẩm không hợp lệ');
        }
    }
}
