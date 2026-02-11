/**
 * Cart Repository v2
 *
 * Uses `orders` + `order_items` tables instead of deprecated `carts` + `cart_items`.
 * Cart is an unpaid order (payment_status = 'pending').
 * Each item gets `cart_code`, `item_order_code`, and `full_code`.
 *
 * @see implementation_plan.md - Phase 3: Cart Flow Refactoring
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CartItem as ClientCartItem, CartItemType, PrintOptions, PrintFileInfo } from '@/lib/store/cart';
import { generateId } from '@/lib/generateId';
import { Order, OrderItem, FulfillmentStatus, ProductionStatus } from '@/types/database';

// =============================================================================
// Types
// =============================================================================

// Cart is an unpaid order
export interface Cart {
    id: string;
    user_id: string | null;
    cart_code: string;
    order_code: string;
    subtotal: number;
    shipping_fee: number;
    discount: number;
    total_amount: number;
    payment_status: 'pending';
    fulfillment_status: FulfillmentStatus;
    shipping_address: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

export interface CartItemDB {
    id: string;
    order_id: string;
    cart_code: string;
    item_order_code: string;
    full_code: string;
    production_status: ProductionStatus;
    item_type: CartItemType;
    name: string;
    price: number;
    unit_price: number;
    total_price: number;
    quantity: number;
    sku?: string;
    image_url?: string;
    product_id?: string;
    product_sku?: string;
    size?: string;
    original_price?: number;
    print_options?: PrintOptions;
    print_files?: PrintFileInfo[];
    description?: string;
    custom_files?: { name: string; url: string }[];
    file_path?: string;
    configuration?: Record<string, unknown>;
    custom_type?: string;
    custom_size?: string;
    print_tech?: string;
    infill?: string;
    layer_height?: string;
    color?: string;
    material?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface CartWithItems extends Cart {
    order_items: CartItemDB[];
    // Alias for CheckoutService compatibility
    cart_items: CartItemDB[];
}

// =============================================================================
// Cart Repository
// =============================================================================

export class CartRepository {
    constructor(private readonly db: SupabaseClient) { }

    /**
     * Get or create cart (unpaid order) for user
     */
    async getOrCreateCart(userId: string): Promise<Cart> {
        // Try to get existing pending order (cart)
        const { data: existing } = await this.db
            .from('orders')
            .select('*')
            .eq('user_id', userId)
            .eq('payment_status', 'pending')
            .single();

        if (existing) {
            return this.mapToCart(existing);
        }

        // Create new cart (order with pending payment)
        const cartCode = generateId.cart();
        const { data, error } = await this.db
            .from('orders')
            .insert({
                user_id: userId,
                cart_code: cartCode,
                order_code: cartCode, // Same as cart_code for new orders
                name: `Cart-${cartCode}`, // Required field - will be updated on checkout
                payment_status: 'pending',
                fulfillment_status: 'pending',
                status: 'pending',
                subtotal: 0,
                shipping_fee: 0,
                discount: 0,
                total_amount: 0,
                deposit_amount: 0,
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return this.mapToCart(data);
    }

    /**
     * Get cart with all items
     */
    async getCartWithItems(userId: string): Promise<CartWithItems | null> {
        const { data, error } = await this.db
            .from('orders')
            .select('*, order_items(*)')
            .eq('user_id', userId)
            .eq('payment_status', 'pending')
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }

        const orderItems = (data.order_items || []).map((item: any) => this.mapToCartItem(item));
        return {
            ...this.mapToCart(data),
            order_items: orderItems,
            cart_items: orderItems, // Alias for CheckoutService compatibility
        };
    }

    /**
     * Add item to cart with auto-generated codes
     */
    async addItem(
        cartId: string,
        cartCode: string,
        item: Omit<ClientCartItem, 'id'>
    ): Promise<CartItemDB> {
        const itemOrderCode = generateId.order();
        const fullCode = `${cartCode}_${itemOrderCode}`;

        const dbItem = this.mapToDbItem(cartId, cartCode, itemOrderCode, fullCode, item);

        const { data, error } = await this.db
            .from('order_items')
            .insert(dbItem)
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Update cart total
        await this.recalculateTotal(cartId);

        return this.mapToCartItem(data);
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
            .from('order_items')
            .update({
                quantity,
            })
            .eq('id', itemId)
            .eq('order_id', cartId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Update cart total
        await this.recalculateTotal(cartId);

        return this.mapToCartItem(data);
    }

    /**
     * Remove item from cart
     */
    async removeItem(itemId: string, cartId: string): Promise<void> {
        const { error } = await this.db
            .from('order_items')
            .delete()
            .eq('id', itemId)
            .eq('order_id', cartId);

        if (error) {
            throw error;
        }

        // Update cart total
        await this.recalculateTotal(cartId);
    }

    /**
     * Clear all items from cart
     */
    async clearCart(cartId: string): Promise<void> {
        const { error } = await this.db
            .from('order_items')
            .delete()
            .eq('order_id', cartId);

        if (error) {
            throw error;
        }

        // Reset cart total to 0
        await this.db
            .from('orders')
            .update({
                subtotal: 0,
                total_amount: 0,
                updated_at: new Date().toISOString(),
            })
            .eq('id', cartId);
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
        const existingItems = existingCart?.order_items || [];

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
                await this.addItem(cart.id, cart.cart_code, clientItem);
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
            .from('order_items')
            .select('*')
            .eq('order_id', cartId)
            .eq('product_id', productId);

        if (size) {
            query = query.eq('configuration->>size', size);
        }

        const { data, error } = await query.single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }

        return this.mapToCartItem(data);
    }

    /**
     * Update shipping address for cart
     */
    async updateShippingAddress(cartId: string, address: Record<string, unknown>): Promise<void> {
        const { error } = await this.db
            .from('orders')
            .update({
                shipping_address: address,
                updated_at: new Date().toISOString(),
            })
            .eq('id', cartId);

        if (error) {
            throw error;
        }
    }

    /**
     * Mark cart as checked out (payment confirmed)
     */
    async markCheckedOut(cartId: string): Promise<void> {
        const { error } = await this.db
            .from('orders')
            .update({
                payment_status: 'paid',
                updated_at: new Date().toISOString(),
            })
            .eq('id', cartId);

        if (error) {
            throw error;
        }
    }

    // ==========================================================================
    // Private Helpers
    // ==========================================================================

    private async recalculateTotal(cartId: string): Promise<void> {
        // Get all items
        const { data: items } = await this.db
            .from('order_items')
            .select('unit_price, quantity')
            .eq('order_id', cartId);

        const subtotal = (items || []).reduce(
            (sum, item) => sum + (item.unit_price * item.quantity),
            0
        );

        await this.db
            .from('orders')
            .update({
                subtotal,
                total_amount: subtotal, // Will be adjusted with shipping later
                updated_at: new Date().toISOString(),
            })
            .eq('id', cartId);
    }

    private mapToCart(data: any): Cart {
        return {
            id: data.id,
            user_id: data.user_id,
            cart_code: data.cart_code || data.order_code,
            order_code: data.order_code,
            subtotal: data.subtotal ?? 0,
            shipping_fee: data.shipping_fee ?? 0,
            discount: data.discount ?? 0,
            total_amount: data.total_amount,
            payment_status: data.payment_status,
            fulfillment_status: data.fulfillment_status || 'pending',
            shipping_address: data.shipping_address || null,
            created_at: data.created_at,
            updated_at: data.updated_at,
        };
    }

    private mapToCartItem(data: any): CartItemDB {
        return {
            id: data.id,
            order_id: data.order_id,
            cart_code: data.cart_code,
            item_order_code: data.item_order_code,
            full_code: data.full_code,
            production_status: data.production_status || 'waiting',
            item_type: data.item_type || data.configuration?.item_type || 'product',
            name: data.name,
            price: data.unit_price,
            unit_price: data.unit_price,
            total_price: data.total_price,
            quantity: data.quantity,
            sku: data.sku,
            image_url: data.configuration?.image_url,
            product_id: data.product_id,
            product_sku: data.sku,
            size: data.configuration?.size,
            original_price: data.configuration?.original_price,
            print_options: data.configuration?.print_options,
            print_files: data.configuration?.print_files,
            description: data.configuration?.description,
            custom_files: data.configuration?.custom_files,
            file_path: data.file_path,
            configuration: data.configuration,
            custom_type: data.custom_type,
            custom_size: data.custom_size,
            print_tech: data.print_tech,
            infill: data.infill,
            layer_height: data.layer_height,
            color: data.color,
            material: data.material,
            notes: data.notes,
            created_at: data.created_at,
            updated_at: data.updated_at,
        };
    }

    private mapToDbItem(
        cartId: string,
        cartCode: string,
        itemOrderCode: string,
        fullCode: string,
        item: Omit<ClientCartItem, 'id'>
    ): Record<string, unknown> {
        return {
            order_id: cartId,
            cart_code: cartCode,
            item_order_code: itemOrderCode,
            full_code: fullCode,
            production_status: 'waiting',
            name: item.name,
            unit_price: item.price,
            total_price: item.price * item.quantity,
            quantity: item.quantity,
            product_id: item.productId,
            sku: item.sku,
            // Store item type and options in dedicated columns (for fast queries)
            item_type: item.type || 'product',
            color: item.printOptions?.color || null,
            material: null, // Not in current PrintOptions, can be extended later
            infill: item.printOptions?.infill || null,
            print_tech: item.printOptions?.type || null, // PrintOptions.type = 'fdm' | 'resin'
            layer_height: item.printOptions?.layerHeight || null,
            custom_type: item.customConfig?.orderType || null,
            custom_size: item.customConfig?.size || item.size || null,
            notes: item.notes || null,
            // Also keep full configuration for flexibility
            configuration: {
                size: item.size,
                image_url: item.image,
                original_price: item.originalPrice,
                print_options: item.printOptions,
                print_files: item.printFiles,
                description: item.description,
                custom_files: item.customFiles,
            },
        };
    }
}
