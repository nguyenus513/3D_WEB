/**
 * Order Controller
 *
 * Request handling layer for orders API.
 * Validates input, calls service, formats response.
 *
 * @see backend-dev-guidelines.md - Rule #2: All Controllers Extend BaseController
 */

import { NextRequest } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { auth } from '@/auth';
import { BaseController, UnauthorizedError } from '@/lib/core/BaseController';
import { OrderService } from '@/services/OrderService';
import { OrderRepository } from '@/repositories/OrderRepository';
import { ProfileRepository } from '@/repositories/ProfileRepository';
import { OrderQuerySchema, CreateOrderSchema } from '@/validators/order.schema';
import { notifyAllAdmins } from '@/lib/notifications';

// =============================================================================
// Supabase Admin Client (Singleton)
// =============================================================================

const supabaseAdmin = getAdminSupabase();

// =============================================================================
// Order Controller
// =============================================================================

export class OrderController extends BaseController {
    private readonly orderService: OrderService;

    constructor() {
        super();
        // Dependency injection
        const orderRepo = new OrderRepository(supabaseAdmin);
        const profileRepo = new ProfileRepository(supabaseAdmin);
        this.orderService = new OrderService(orderRepo, profileRepo);
    }

    /**
     * GET /api/orders
     * Get current user's orders
     */
    async getOrders(request: NextRequest) {
        return this.wrapHandler(async () => {
            // Authenticate
            const session = await auth();
            if (!session?.user?.email) {
                throw new UnauthorizedError();
            }

            // Parse query params
            const searchParams = Object.fromEntries(request.nextUrl.searchParams);
            const query = OrderQuerySchema.parse(searchParams);

            // Get orders
            const { orders, total } = await this.orderService.getUserOrders(
                session.user.email,
                {
                    page: query.page,
                    limit: query.limit,
                    status: query.status,
                    fromDate: query.from_date,
                    toDate: query.to_date,
                }
            );

            return this.handleSuccess(orders, {
                meta: {
                    page: query.page,
                    limit: query.limit,
                    total,
                },
            });
        }, 'OrderController.getOrders');
    }

    /**
     * POST /api/orders
     * Create a new order
     */
    async createOrder(request: NextRequest) {
        return this.wrapHandler(async () => {
            // Authenticate
            const session = await auth();
            if (!session?.user?.email) {
                throw new UnauthorizedError();
            }

            // Parse and validate body
            const body = await request.json();
            const input = CreateOrderSchema.parse(body);

            // Create order
            const order = await this.orderService.createOrder(
                session.user.email,
                input
            );

            // Notify admins about new order (fire-and-forget)
            const totalAmount = input.items.reduce(
                (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
                0
            );
            notifyAllAdmins({
                title: `Đơn hàng mới #${order.order_code}`,
                message: `${input.items.length} sản phẩm - ${totalAmount.toLocaleString('vi-VN')}đ`,
                type: 'payment',
                refId: order.id,
                refType: 'order',
            }).catch(err => console.error('[OrderController] Failed to notify admins:', err));

            return this.handleSuccess(order, { status: 201 });
        }, 'OrderController.createOrder');
    }

    /**
     * GET /api/orders/[id]
     * Get a specific order
     */
    async getOrderById(request: NextRequest, orderId: string) {
        return this.wrapHandler(async () => {
            // Authenticate
            const session = await auth();
            if (!session?.user?.email) {
                throw new UnauthorizedError();
            }

            // Check if admin (for full access)
            const userRole = (session.user as { role?: string }).role;
            const isAdmin = userRole === 'admin';

            // Get order
            const order = await this.orderService.getOrderById(
                orderId,
                session.user.email,
                isAdmin
            );

            return this.handleSuccess(order);
        }, 'OrderController.getOrderById');
    }

    /**
     * DELETE /api/orders/[id]
     * Cancel an order
     */
    async cancelOrder(request: NextRequest, orderId: string) {
        return this.wrapHandler(async () => {
            // Authenticate
            const session = await auth();
            if (!session?.user?.email) {
                throw new UnauthorizedError();
            }

            // Parse optional reason from body
            let reason: string | undefined;
            try {
                const body = await request.json();
                reason = body.reason;
            } catch {
                // No body provided, that's fine
            }

            // Cancel order
            const order = await this.orderService.cancelOrder(
                orderId,
                session.user.email,
                reason
            );

            return this.handleSuccess(order);
        }, 'OrderController.cancelOrder');
    }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const orderController = new OrderController();

