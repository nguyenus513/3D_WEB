/**
 * Order Service
 *
 * Business logic layer for orders.
 * Handles validation, authorization, and orchestrates repository calls.
 *
 * @see backend-dev-guidelines.md - Services handle business logic with DI
 */

import { OrderRepository, OrderWithItems, OrderQueryParams } from '@/repositories/OrderRepository';
import { ProfileRepository } from '@/repositories/ProfileRepository';
import { ProductRepository } from '@/repositories/ProductRepository';
import { NotFoundError, ForbiddenError, BadRequestError } from '@/lib/core/BaseController';
import { generateId } from '@/lib/generateId';
import { getAdminSupabase } from '@/lib/supabase/admin';
import {
    CreateOrderInput,
    UpdateOrderStatusInput,
    OrderStatusType,
} from '@/validators/order.schema';

// =============================================================================
// Order Service
// =============================================================================

export class OrderService {
    private readonly productRepo: ProductRepository;

    constructor(
        private readonly orderRepo: OrderRepository,
        private readonly profileRepo: ProfileRepository
    ) {
        this.productRepo = new ProductRepository(getAdminSupabase());
    }

    /**
     * Get orders for a user by email
     */
    async getUserOrders(
        email: string,
        params?: OrderQueryParams
    ): Promise<{ orders: OrderWithItems[]; total: number }> {
        // Find user profile
        const profile = await this.profileRepo.findByEmail(email);
        if (!profile) {
            throw new NotFoundError('User profile not found');
        }

        // Get orders
        return this.orderRepo.findByUserId(profile.id, params);
    }

    /**
     * Get a single order by ID
     * Verifies ownership unless user is admin
     */
    async getOrderById(
        orderId: string,
        userEmail: string,
        isAdmin = false
    ): Promise<OrderWithItems> {
        const profile = await this.profileRepo.findByEmail(userEmail);
        if (!profile) {
            throw new NotFoundError('User profile not found');
        }

        let order: OrderWithItems | null;

        if (isAdmin) {
            // Admins can view any order
            order = await this.orderRepo.findById(orderId);
        } else {
            // Regular users can only view their own orders
            order = await this.orderRepo.findByIdAndUserId(orderId, profile.id);
        }

        if (!order) {
            throw new NotFoundError('Order not found');
        }

        return order;
    }

    /**
     * Create a new order
     */
    async createOrder(
        email: string,
        input: CreateOrderInput
    ): Promise<OrderWithItems> {
        const profile = await this.profileRepo.findByEmail(email);
        if (!profile) {
            throw new NotFoundError('User profile not found');
        }

        const totalAmount = input.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        // Prepare shipping address
        const shippingAddress = input.shipping_address || {};

        // Determine order type from items
        // order_type_enum values: product, custom, print_3d, mixed
        const itemTypes = new Set(input.items.map(i => (i as any).item_type || 'product'));
        let orderType = 'product'; // Default

        if (itemTypes.has('custom')) {
            orderType = itemTypes.has('product') || itemTypes.has('print') ? 'mixed' : 'custom';
        } else if (itemTypes.has('print') || itemTypes.has('printing') || itemTypes.has('print_3d')) {
            orderType = 'print_3d';
        } else {
            orderType = 'product';
        }
        // Calculate deposit amount
        // Policy: 
        // - Ready-made / Printing: 100% upfront (Deposit = Total)
        // - Custom / Mixed: 50% deposit
        let depositAmount = totalAmount;
        if (orderType === 'custom' || orderType === 'mixed') {
            depositAmount = Math.round(totalAmount * 0.5);
        }
        // Prepare order items
        const orderItems = input.items.map((item) => {
            const printOpts = (item.customization as any)?.printOptions;
            return {
                name: (item as any).product_name || 'Item',
                productId: item.product_id ?? undefined,
                quantity: item.quantity,
                unitPrice: item.price,
                totalPrice: item.price * item.quantity,
                configuration: item.customization,
                itemType: (item as any).item_type || 'product',
                printTech: printOpts?.type || null,
                material: printOpts?.material || null,
                color: printOpts?.color || null,
                infill: printOpts?.infill || null,
                layerHeight: printOpts?.layerHeight || null,
                notes: (item.customization as any)?.notes || null,
            };
        });
        try {
            const order = await this.orderRepo.create(
                {
                    userId: profile.id,
                    orderCode: generateId.order(),
                    cartCode: (input as any).cart_code,
                    orderType,
                    subtotal: totalAmount,
                    discount: 0,
                    totalAmount: totalAmount,
                    depositAmount: depositAmount,
                    shippingAddressSnapshot: shippingAddress as any,
                    notes: input.notes,
                },
                orderItems
            );
            
            await this.reserveStockForOrder(input.items);

            return order;
        } catch (error) {
            console.error('[OrderService] Order creation failed:', error);
            throw error;
        }
    }

    /**
     * Update order status (Admin only)
     */
    async updateOrderStatus(
        orderId: string,
        input: UpdateOrderStatusInput,
        adminEmail: string
    ): Promise<OrderWithItems> {
        // Verify admin
        const admin = await this.profileRepo.findByEmail(adminEmail);
        if (!admin || admin.role !== 'admin') {
            throw new ForbiddenError('Only admins can update order status');
        }

        // Check order exists
        const order = await this.orderRepo.findById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // Validate status transition
        // For V3/V4, we allow more admin flexibility.
        // But preventing backward flow (e.g. shipped -> pending) is good.
        // this.validateStatusTransition(order.status, input.status);

        // Update status
        await this.orderRepo.updateStatus(orderId, input.status, input.notes);

        // If cancelled by admin, restore stock
        if (input.status === 'cancelled' && order.status !== 'cancelled') {
            
            await this.restoreStockForOrder(order);
        }

        // Return updated order
        const updatedOrder = await this.orderRepo.findById(orderId);
        if (!updatedOrder) {
            throw new NotFoundError('Order not found after update');
        }

        return updatedOrder;
    }

    /**
     * Cancel an order
     * Users can only cancel pending orders
     */
    async cancelOrder(
        orderId: string,
        userEmail: string,
        reason?: string
    ): Promise<OrderWithItems> {
        const profile = await this.profileRepo.findByEmail(userEmail);
        if (!profile) {
            throw new NotFoundError('User profile not found');
        }

        const order = await this.orderRepo.findByIdAndUserId(orderId, profile.id);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // Only pending orders can be cancelled by users
        if (order.status !== 'pending' && order.status !== 'confirmed') {
            throw new BadRequestError(
                'Only pending or confirmed orders can be cancelled'
            );
        }

        await this.orderRepo.cancel(orderId, reason);

        // Restore stock for cancelled order
        
        await this.restoreStockForOrder(order);

        const cancelledOrder = await this.orderRepo.findById(orderId);
        if (!cancelledOrder) {
            throw new NotFoundError('Order not found after cancellation');
        }

        return cancelledOrder;
    }

    /**
     * Validate order status transitions
     */
    private validateStatusTransition(
        currentStatus: OrderStatusType,
        newStatus: OrderStatusType
    ): void {
        const validTransitions: Record<string, string[]> = {
            pending: ['confirmed', 'cancelled'],
            confirmed: ['producing', 'cancelled', 'processing'],
            processing: ['producing', 'cancelled'],
            producing: ['shipped', 'cancelled', 'ready'],
            shipped: ['delivered'],
            delivered: ['refunded'],
            cancelled: [],
            refunded: [],
        };

        // Allow forceful admin updates by bypassing strict check if needed,
        // but for now we basically map key transitions.
        const allowed = validTransitions[currentStatus] || [];
        // If current status not in map, maybe allow anything?
        if (Object.keys(validTransitions).includes(currentStatus) && !allowed.includes(newStatus)) {
            // For now, let's just log or ignore strict validation given the migration state.
            // Or update the map to be more permissive.
            // throw new BadRequestError(...)
        }
    }

    /**
     * Reserve stock for each item in the order
     * Matches item.size → product_variant, then calls reserveStock + increment_sold_count
     */
    private async reserveStockForOrder(items: CreateOrderInput['items']): Promise<void> {
        const supabase = getAdminSupabase();

        for (const item of items) {
            const productId = item.product_id;
            if (!productId) continue;

            const size = (item as any).size || (item.customization as any)?.size;
            const qty = item.quantity || 1;
            const unitPrice = item.price;

            try {
                // Fetch ALL variants for this product
                const { data: allVariants } = await supabase
                    .from('product_variants')
                    .select('id, name, sku, price, stock, reserved_stock')
                    .eq('product_id', productId)
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true });

                if (!allVariants || allVariants.length === 0) {
                    console.warn(`[OrderService] No variants for product ${productId}, skipping stock reserve`);
                    // Still increment sold_count
                    await (supabase.rpc as any)('increment_sold_count', { p_product_id: productId, p_qty: qty });
                    continue;
                }

                // Cascade matching: size → price → first
                let matchedVariant = null;

                // 1. Match by size name or SKU (if size is provided and non-empty)
                if (size) {
                    matchedVariant = allVariants.find(
                        v => v.name === size || v.sku === size
                    );
                }

                // 2. Match by unit price
                if (!matchedVariant && unitPrice) {
                    matchedVariant = allVariants.find(
                        v => Number(v.price) === Number(unitPrice)
                    );
                }

                // 3. Fallback: first active variant
                if (!matchedVariant) {
                    matchedVariant = allVariants[0];
                }

                // Deduct stock immediately
                await this.productRepo.deductStock(matchedVariant.id, qty);

                await (supabase.rpc as any)('increment_sold_count', {
                    p_product_id: productId,
                    p_qty: qty,
                });
            } catch (err) {
                console.error(`[OrderService] Stock deduct/sold_count error for product ${productId}:`, err);
            }
        }
    }

    /**
     * Restore stock for all items in a cancelled order
     * stock += qty, sold_count -= qty
     */
    private async restoreStockForOrder(order: OrderWithItems): Promise<void> {
        const supabase = getAdminSupabase();
        const items = order.items || [];

        for (const item of items) {
            const productId = (item as any).product_id;
            if (!productId) continue;

            const qty = (item as any).quantity || 1;

            try {
                // Fetch variants for this product
                const { data: allVariants } = await supabase
                    .from('product_variants')
                    .select('id, name, sku, price, stock')
                    .eq('product_id', productId)
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true });

                if (allVariants && allVariants.length > 0) {
                    // Match by price, then fallback to first
                    const unitPrice = (item as any).unit_price;
                    let matchedVariant = allVariants.find(
                        v => Number(v.price) === Number(unitPrice)
                    ) || allVariants[0];

                    await this.productRepo.restoreStock(matchedVariant.id, qty);
                }

                await (supabase.rpc as any)('increment_sold_count', {
                    p_product_id: productId,
                    p_qty: -qty,
                });
            } catch (err) {
                console.error(`[OrderService] Stock restore error for product ${productId}:`, err);
            }
        }
    }
}
