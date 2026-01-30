/**
 * Cart Repository
 *
 * Data access layer for carts and cart_items tables.
 * Handles server-side cart persistence and sync with client-side Zustand store.
 *
 * @see backend-dev-guidelines.md - Rule #6: Use Repository Pattern for Data Access
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CartItem as ClientCartItem, CartItemType, PrintOptions, PrintFileInfo } from '@/lib/store/cart';

// =============================================================================
// Types
// =============================================================================

export interface Cart {
    id: string;
    user_id: string;
    created_at: string;
    updated_at: string;
}

export interface CartItemDB {
    id: string;
    cart_id: string;
    item_type: CartItemType;
    name: string;
    price: number;
    quantity: number;
    image_url?: string;
    product_id?: string;
    product_sku?: string;
    size?: string;
    original_price?: number;
    print_options?: PrintOptions;
    print_files?: PrintFileInfo[];
    description?: string;
    custom_files?: { name: string; url: string }[];
    created_at: string;
    updated_at: string;
}

export interface CartWithItems extends Cart {
    cart_items: CartItemDB[];
}

// =============================================================================
// Cart Repository
// =============================================================================

export class CartRepository {
    constructor(private readonly db: SupabaseClient) { }

    /**
     * Get or create cart for user
     */
    async getOrCreateCart(userId: string): Promise<Cart> {
        // Try to get existing cart
        const { data: existing } = await this.db
            .from('carts')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (existing) {
            return existing as Cart;
        }

        // Create new cart
        const { data, error } = await this.db
            .from('carts')
            .insert({ user_id: userId })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data as Cart;
    }

    /**
     * Get cart with all items
     */
    async getCartWithItems(userId: string): Promise<CartWithItems | null> {
        const { data, error } = await this.db
            .from('carts')
            .select('*, cart_items(*)')
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }

        return data as CartWithItems;
    }

    /**
     * Add item to cart
     */
    async addItem(
        cartId: string,
        item: Omit<ClientCartItem, 'id'>
    ): Promise<CartItemDB> {
        const dbItem = this.mapToDbItem(cartId, item);

        const { data, error } = await this.db
            .from('cart_items')
            .insert(dbItem)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data as CartItemDB;
    }

    /**
     * Update item quantity
     */
    async updateItemQuantity(
        itemId: string,
        cartId: string,
        quantity: number
    ): Promise<CartItemDB> {
        const { data, error } = await this.db
            .from('cart_items')
            .update({ quantity, updated_at: new Date().toISOString() })
            .eq('id', itemId)
            .eq('cart_id', cartId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data as CartItemDB;
    }

    /**
     * Remove item from cart
     */
    async removeItem(itemId: string, cartId: string): Promise<void> {
        const { error } = await this.db
            .from('cart_items')
            .delete()
            .eq('id', itemId)
            .eq('cart_id', cartId);

        if (error) {
            throw error;
        }
    }

    /**
     * Clear all items from cart
     */
    async clearCart(cartId: string): Promise<void> {
        const { error } = await this.db
            .from('cart_items')
            .delete()
            .eq('cart_id', cartId);

        if (error) {
            throw error;
        }
    }

    /**
     * Sync client cart to server
     * Merges guest cart items with existing user cart
     */
    async syncFromClient(
        userId: string,
        clientItems: ClientCartItem[]
    ): Promise<CartWithItems> {
        const cart = await this.getOrCreateCart(userId);

        // Get existing server items
        const existingCart = await this.getCartWithItems(userId);
        const existingItems = existingCart?.cart_items || [];

        // Merge logic: client items override server items for same product
        for (const clientItem of clientItems) {
            const existingIndex = existingItems.findIndex(
                (si) =>
                    si.item_type === clientItem.type &&
                    si.product_id === clientItem.productId &&
                    si.size === clientItem.size
            );

            if (existingIndex >= 0) {
                // Update quantity (take max of client and server)
                const existing = existingItems[existingIndex];
                await this.updateItemQuantity(
                    existing.id,
                    cart.id,
                    Math.max(existing.quantity, clientItem.quantity)
                );
            } else {
                // Add new item
                await this.addItem(cart.id, clientItem);
            }
        }

        return (await this.getCartWithItems(userId))!;
    }

    /**
     * Find existing product item in cart
     */
    async findProductItem(
        cartId: string,
        productId: string,
        size?: string
    ): Promise<CartItemDB | null> {
        let query = this.db
            .from('cart_items')
            .select('*')
            .eq('cart_id', cartId)
            .eq('item_type', 'product')
            .eq('product_id', productId);

        if (size) {
            query = query.eq('size', size);
        }

        const { data, error } = await query.single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }

        return data as CartItemDB;
    }

    // ==========================================================================
    // Private Helpers
    // ==========================================================================

    private mapToDbItem(
        cartId: string,
        item: Omit<ClientCartItem, 'id'>
    ): Omit<CartItemDB, 'id' | 'created_at' | 'updated_at'> {
        return {
            cart_id: cartId,
            item_type: item.type,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image_url: item.image,
            product_id: item.productId,
            product_sku: item.sku,
            size: item.size,
            original_price: item.originalPrice,
            print_options: item.printOptions,
            print_files: item.printFiles,
            description: item.description,
            custom_files: item.customFiles,
        };
    }
}
