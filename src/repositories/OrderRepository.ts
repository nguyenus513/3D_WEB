/**
 * Order Repository
 *
 * Data access layer for orders table.
 * Handles all database operations related to orders.
 *
 * @see backend-dev-guidelines.md - Rule #6: Use Repository Pattern for Data Access
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { OrderStatusType } from '@/validators/order.schema';

// =============================================================================
// Types
// =============================================================================

export interface Order {
    id: string;
    user_id: string;
    status: OrderStatusType;
    total_amount: number;
    payment_method: string;
    payment_status: string;
    shipping_address: Record<string, unknown>;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    quantity: number;
    price: number;
    customization?: Record<string, unknown>;
}

export interface OrderWithItems extends Order {
    order_items: OrderItem[];
}

export interface OrderQueryParams {
    page?: number;
    limit?: number;
    status?: OrderStatusType;
    fromDate?: Date;
    toDate?: Date;
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
            .select('*, order_items(*)', { count: 'exact' })
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
            .select('*, order_items(*)')
            .eq('id', orderId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
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
            .select('*, order_items(*)')
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
     */
    async create(
        userId: string,
        orderData: {
            totalAmount: number;
            paymentMethod: string;
            shippingAddress: Record<string, unknown>;
            notes?: string;
        },
        items: Array<{
            productId: string;
            quantity: number;
            price: number;
            customization?: Record<string, unknown>;
        }>
    ): Promise<OrderWithItems> {
        // Start transaction
        const { data: order, error: orderError } = await this.db
            .from('orders')
            .insert({
                user_id: userId,
                status: 'pending',
                total_amount: orderData.totalAmount,
                payment_method: orderData.paymentMethod,
                payment_status: 'pending',
                shipping_address: orderData.shippingAddress,
                notes: orderData.notes,
            })
            .select()
            .single();

        if (orderError) {
            throw orderError;
        }

        // Insert order items
        const orderItems = items.map((item) => ({
            order_id: order.id,
            product_id: item.productId,
            quantity: item.quantity,
            price: item.price,
            customization: item.customization,
        }));

        const { data: insertedItems, error: itemsError } = await this.db
            .from('order_items')
            .insert(orderItems)
            .select();

        if (itemsError) {
            // Rollback: delete the order if items failed
            await this.db.from('orders').delete().eq('id', order.id);
            throw itemsError;
        }

        return {
            ...order,
            order_items: insertedItems,
        } as OrderWithItems;
    }

    /**
     * Update order status
     */
    async updateStatus(
        orderId: string,
        status: OrderStatusType,
        notes?: string
    ): Promise<Order> {
        const updateData: Record<string, unknown> = {
            status,
            updated_at: new Date().toISOString(),
        };

        if (notes) {
            updateData.notes = notes;
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
}
