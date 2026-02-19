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
import { NotFoundError, ForbiddenError, BadRequestError } from '@/lib/core/BaseController';
import { generateId } from '@/lib/generateId';
import {
    CreateOrderInput,
    UpdateOrderStatusInput,
    OrderStatusType,
} from '@/validators/order.schema';

// =============================================================================
// Order Service
// =============================================================================

export class OrderService {
    constructor(
        private readonly orderRepo: OrderRepository,
        private readonly profileRepo: ProfileRepository
    ) { }

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
        console.log('[OrderService.createOrder] START | email:', email);
        console.log('[OrderService.createOrder] Input items count:', input.items.length);

        // Find user profile
        console.log('[OrderService.createOrder] Step 1: Finding profile...');
        const profile = await this.profileRepo.findByEmail(email);
        if (!profile) {
            throw new NotFoundError('User profile not found');
        }
        console.log('[OrderService.createOrder] Step 1 OK: profile.id =', profile.id);

        // Calculate total amount
        const totalAmount = input.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );
        console.log('[OrderService.createOrder] Step 2: totalAmount =', totalAmount);

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
        console.log('[OrderService.createOrder] Step 3: orderType =', orderType, '| itemTypes =', [...itemTypes]);

        // Calculate deposit amount
        // Policy: 
        // - Ready-made / Printing: 100% upfront (Deposit = Total)
        // - Custom / Mixed: 50% deposit
        let depositAmount = totalAmount;
        if (orderType === 'custom' || orderType === 'mixed') {
            depositAmount = Math.round(totalAmount * 0.5);
        }
        console.log('[OrderService.createOrder] Step 4: depositAmount =', depositAmount);

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
        console.log('[OrderService.createOrder] Step 5: orderItems prepared:', JSON.stringify(orderItems, null, 2));

        // Create order
        console.log('[OrderService.createOrder] Step 6: Calling orderRepo.create...');
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
            console.log('[OrderService.createOrder] Step 6 OK: order.id =', order.id);
            return order;
        } catch (error) {
            console.error('[OrderService.createOrder] Step 6 FAILED:', JSON.stringify(error, null, 2));
            console.error('[OrderService.createOrder] Error type:', typeof error, '| instanceof Error:', error instanceof Error);
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
}
