/**
 * Order Repository - Schema v3
 *
 * Data access layer for orders and order_items tables.
 * Handles all database operations related to orders.
 *
 * @see backend-dev-guidelines.md - Rule #6: Use Repository Pattern for Data Access
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { generateId } from '@/lib/generateId';
import {
    Order,
    OrderItem,
    OrderStatus,
    PaymentStatus,
    ShippingAddressSnapshot,
    OrderItemConfiguration,
} from '@/types/database';

// =============================================================================
// Types
// =============================================================================

export interface OrderWithItems extends Order {
    items: OrderItem[];
}

export interface OrderQueryParams {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    fromDate?: Date;
    toDate?: Date;
}

export interface CreateOrderParams {
    userId: string;
    orderCode: string;
    name?: string; // Order name (auto-generated if not provided)
    cartCode?: string; // 8-char hex, auto-generated if not provided
    orderType?: string; // ready_made, custom, printing, mixed
    addressId?: string;
    subtotal: number;
    shippingFee: number;
    discount: number;
    totalAmount: number;
    depositAmount?: number;
    depositPaid?: boolean;
    shippingAddressSnapshot?: ShippingAddressSnapshot;
    shippingAddress?: Record<string, unknown> | null; // Alias for cart's shipping_address
    notes?: string;
}

export interface CreateOrderItemParams {
    productId?: string;
    name: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    configuration?: OrderItemConfiguration;
    itemOrderCode?: string; // 8-char hex, auto-generated if not provided
    // Additional fields for different item types
    itemType?: string | null;     // 'product' | 'printing' | 'custom'
    customType?: string | null;   // 'single' | 'couple' | 'family'
    customSize?: string | null;   // 'S' | 'M' | 'L'
    printTech?: string | null;    // 'fdm' | 'sla' | 'resin'
    infill?: string | null;       // '20' | '50' | '100' (as string)
    layerHeight?: string | null;  // '0.1' | '0.2' (as string)
    color?: string | null;
    material?: string | null;     // 'PLA' | 'ABS' | 'PETG'
    notes?: string | null;
}

// =============================================================================
// Order Repository
// =============================================================================

export class OrderRepository {
    constructor(private readonly db: SupabaseClient) { }

    /**
     * Find all orders for a user with pagination
     */
    async findByUserId(
        userId: string,
        params: OrderQueryParams = {}
    ): Promise<{ orders: OrderWithItems[]; total: number }> {
        const { page = 1, limit = 20, status, fromDate, toDate } = params;
        const offset = (page - 1) * limit;

        let query = this.db
            .from('orders')
            .select('*, items:order_items(*)', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq('status', status);
        }

        if (fromDate) {
            query = query.gte('created_at', fromDate.toISOString());
        }

        if (toDate) {
            query = query.lte('created_at', toDate.toISOString());
        }

        const { data, error, count } = await query;

        if (error) {
            throw error;
        }

        return {
            orders: (data as OrderWithItems[]) || [],
            total: count || 0,
        };
    }

    /**
     * Find a single order by ID
     */
    async findById(orderId: string): Promise<OrderWithItems | null> {
        const { data, error } = await this.db
            .from('orders')
            .select('*, items:order_items(*)')
            .eq('id', orderId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }

        return data as OrderWithItems;
    }

    /**
     * Find order by order_code
     */
    async findByCode(orderCode: string): Promise<OrderWithItems | null> {
        const { data, error } = await this.db
            .from('orders')
            .select('*, items:order_items(*)')
            .eq('order_code', orderCode)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }

        return data as OrderWithItems;
    }

    /**
     * Find order by ID and user ID (for ownership verification)
     */
    async findByIdAndUserId(orderId: string, userId: string): Promise<OrderWithItems | null> {
        const { data, error } = await this.db
            .from('orders')
            .select('*, items:order_items(*)')
            .eq('id', orderId)
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }

        return data as OrderWithItems;
    }

    /**
     * Create a new order with items
     * Generates cart_code (8-char) for order and item_order_code (8-char) for each item
     */
    async create(
        orderData: CreateOrderParams,
        items: CreateOrderItemParams[]
    ): Promise<OrderWithItems> {
        // Insert order
        const { data: order, error: orderError } = await this.db
            .from('orders')
            .insert({
                order_code: orderData.orderCode,
                order_type: orderData.orderType || 'ready_made',
                user_id: orderData.userId,
                subtotal: orderData.subtotal,
                shipping_fee: orderData.shippingFee,
                discount: orderData.discount,
                total_amount: orderData.totalAmount,
                deposit_amount: orderData.depositAmount || 0,
                status: 'pending' as OrderStatus,
                payment_status: 'pending' as PaymentStatus,
                shipping_address: orderData.shippingAddressSnapshot || null,
                customer_note: orderData.notes || null,
            })
            .select()
            .single();

        if (orderError) {
            console.error('[OrderRepository.create] Order insert error:', JSON.stringify(orderError, null, 2));
            throw orderError;
        }

        // Generate unique item_code for each item (with collision detection)
        const usedItemCodes = new Set<string>();
        const orderItems = items.map((item) => {
            let itemCode = item.itemOrderCode || generateId.order();

            // Ensure uniqueness within this order
            while (usedItemCodes.has(itemCode)) {
                itemCode = generateId.order();
            }
            usedItemCodes.add(itemCode);

            // Generate full_code = {order_code}_{item_code}
            const fullCode = `${orderData.orderCode}_${itemCode}`;

            return {
                order_id: order.id,
                product_id: item.productId || null,
                name: item.name,
                sku: item.sku || null,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total_price: item.totalPrice,
                spec: item.configuration || {}, // DB uses 'spec' not 'configuration'
                item_code: itemCode, // DB uses 'item_code' not 'item_order_code'
                full_code: fullCode,
                production_status: 'waiting',
                item_type: item.itemType || 'product',
                notes: item.notes || null,
            };
        });

        const { data: insertedItems, error: itemsError } = await this.db
            .from('order_items')
            .insert(orderItems)
            .select();

        if (itemsError) {
            console.error('[OrderRepository.create] Order items insert error:', JSON.stringify(itemsError, null, 2));
            // Rollback: delete the order if items failed
            await this.db.from('orders').delete().eq('id', order.id);
            throw itemsError;
        }

        return {
            ...order,
            items: insertedItems,
        } as OrderWithItems;
    }

    /**
     * Update order status
     */
    async updateStatus(
        orderId: string,
        status: OrderStatus,
        adminNotes?: string
    ): Promise<Order> {
        const updateData: Record<string, unknown> = {
            status,
            updated_at: new Date().toISOString(),
        };

        if (adminNotes) {
            updateData.admin_notes = adminNotes;
        }

        // Set timestamp based on status
        if (status === 'confirmed') {
            updateData.confirmed_at = new Date().toISOString();
        } else if (status === 'paid') {
            updateData.paid_at = new Date().toISOString();
            updateData.payment_status = 'paid';
        } else if (status === 'completed') {
            updateData.completed_at = new Date().toISOString();
        }

        const { data, error } = await this.db
            .from('orders')
            .update(updateData)
            .eq('id', orderId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data as Order;
    }

    /**
     * Update payment status
     */
    async updatePaymentStatus(
        orderId: string,
        paymentStatus: PaymentStatus
    ): Promise<Order> {
        const updateData: Record<string, unknown> = {
            payment_status: paymentStatus,
            updated_at: new Date().toISOString(),
        };

        if (paymentStatus === 'paid') {
            updateData.paid_at = new Date().toISOString();
        }

        const { data, error } = await this.db
            .from('orders')
            .update(updateData)
            .eq('id', orderId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data as Order;
    }

    /**
     * Cancel an order
     */
    async cancel(orderId: string, reason?: string): Promise<Order> {
        return this.updateStatus(orderId, 'cancelled', reason);
    }

    /**
     * Get all orders (admin)
     */
    async findAll(params: OrderQueryParams = {}): Promise<{ orders: OrderWithItems[]; total: number }> {
        const { page = 1, limit = 50, status, fromDate, toDate } = params;
        const offset = (page - 1) * limit;

        let query = this.db
            .from('orders')
            .select('*, items:order_items(*), user:profiles(*)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq('status', status);
        }

        if (fromDate) {
            query = query.gte('created_at', fromDate.toISOString());
        }

        if (toDate) {
            query = query.lte('created_at', toDate.toISOString());
        }

        const { data, error, count } = await query;

        if (error) {
            throw error;
        }

        return {
            orders: (data as OrderWithItems[]) || [],
            total: count || 0,
        };
    }

    /**
     * Update order fulfillment status
     */
    async updateFulfillmentStatus(
        orderId: string,
        status: 'pending' | 'processing' | 'completed'
    ): Promise<Order> {
        const { data, error } = await this.db
            .from('orders')
            .update({
                fulfillment_status: status,
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data as Order;
    }

    /**
     * Update order item production status
     */
    async updateProductionStatus(
        itemId: string,
        status: 'waiting' | 'printing' | 'done' | 'error'
    ): Promise<OrderItem> {
        const { data, error } = await this.db
            .from('order_items')
            .update({ production_status: status })
            .eq('id', itemId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data as OrderItem;
    }

    /**
     * Find items by production status (for admin printing page)
     */
    async findItemsByProductionStatus(
        status?: 'waiting' | 'printing' | 'done' | 'error',
        paidOnly: boolean = true
    ): Promise<OrderItem[]> {
        let query = this.db
            .from('order_items')
            .select('*, order:orders!inner(*)');

        if (status) {
            query = query.eq('production_status', status);
        }

        if (paidOnly) {
            query = query.eq('order.payment_status', 'paid');
        }

        const { data, error } = await query.order('created_at', { ascending: true });

        if (error) {
            throw error;
        }

        return (data || []) as OrderItem[];
    }
}
