/**
 * Admin Order Controller
 *
 * Request handling layer for admin order management APIs.
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BaseController, UnauthorizedError, NotFoundError, BadRequestError } from '@/lib/core/BaseController';
import { OrderService } from '@/services/OrderService';
import { OrderRepository } from '@/repositories/OrderRepository';
import { ProfileRepository } from '@/repositories/ProfileRepository';
import { config } from '@/config/unifiedConfig';
import { requireAdmin } from '@/lib/security/admin-guard';

// =============================================================================
// Supabase Admin Client
// =============================================================================

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

// =============================================================================
// Admin Order Controller
// =============================================================================

export class AdminOrderController extends BaseController {
    private readonly orderService: OrderService;

    constructor() {
        super();
        const orderRepo = new OrderRepository(supabaseAdmin);
        const profileRepo = new ProfileRepository(supabaseAdmin);
        this.orderService = new OrderService(orderRepo, profileRepo);
    }

    /**
     * GET /api/admin/orders
     * List all orders with profile data (admin only)
     */
    async listOrders(request: NextRequest) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            const { searchParams } = new URL(request.url);
            const orderType = searchParams.get('type') || 'all';
            const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
            const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

            // Get orders with profiles
            const result = await this.getOrdersWithProfiles(orderType, page, limit);

            return this.handleSuccess(result);
        }, 'AdminOrderController.listOrders');
    }

    /**
     * GET /api/admin/orders/[id]
     * Get single order by ID with all related data (admin only)
     */
    async getOrder(request: NextRequest, orderId: string) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            // First try order_child table (new direct orders)
            const { data: childOrder, error: childError } = await supabaseAdmin
                .from('order_child')
                .select('*')
                .eq('id', orderId)
                .single();

            if (childOrder && !childError) {
                // Get profile for child order
                let profile = null;
                if (childOrder.user_id) {
                    const { data: profileData } = await supabaseAdmin
                        .from('profiles')
                        .select('id, full_name, email, phone, customer_code')
                        .eq('id', childOrder.user_id)
                        .single();
                    profile = profileData;
                }

                // Transform to unified format
                return this.handleSuccess({
                    order: {
                        id: childOrder.id,
                        order_code: childOrder.code_child,
                        order_type: childOrder.product_type || 'product',
                        status: childOrder.status,
                        subtotal: childOrder.total_price,
                        shipping_fee: 0,
                        total: childOrder.total_price,
                        deposit_amount: 0,
                        deposit_paid: false,
                        customer_note: '',
                        admin_note: '',
                        shipping_code: '',
                        created_at: childOrder.created_at,
                        updated_at: childOrder.updated_at,
                        payment_qr_url: childOrder.payment_qr_url,
                        metadata: childOrder.metadata,
                        source: 'order_child',
                        // Simulated order items from child order
                        order_items: [{
                            id: childOrder.id,
                            product_id: childOrder.product_id,
                            product_name: childOrder.product_name,
                            product_sku: childOrder.product_sku,
                            product_image: null,
                            size: '',
                            quantity: childOrder.quantity,
                            unit_price: childOrder.unit_price,
                            total_price: childOrder.total_price,
                        }],
                    },
                    profile,
                });
            }

            // Fallback to legacy orders table
            const { data: order, error } = await supabaseAdmin
                .from('orders')
                .select(`
                    *,
                    profiles:user_id (id, full_name, email, phone, customer_code),
                    order_items (*),
                    order_configs (*),
                    order_files (*),
                    addresses:shipping_address_id (*)
                `)
                .eq('id', orderId)
                .single();

            if (error || !order) {
                throw new NotFoundError('Order not found');
            }

            // Map order_configs to legacy format for backward compatibility
            const config = order.order_configs?.[0] || null;
            let custom_config = null;
            let printing_config = null;

            if (order.order_type === 'custom' && config) {
                custom_config = {
                    type: config.custom_type || 'unknown',
                    size: config.custom_size || order.order_items?.[0]?.size || 'Chưa chọn',
                    notes: order.customer_note || '',
                    images: (order.order_files || [])
                        .filter((f: { file_type: string }) => f.file_type === 'photo')
                        .map((f: { file_id: string; file_name: string | null }) => ({
                            id: f.file_id,
                            name: f.file_name || '',
                            url: `https://drive.google.com/file/d/${f.file_id}/view`,
                            thumbnail: `https://drive.google.com/thumbnail?id=${f.file_id}&sz=w400`,
                        })),
                };
            } else if (order.order_type === 'custom' && !config && order.custom_config) {
                custom_config = order.custom_config;
            } else if (order.order_type === 'custom' && !config && !order.custom_config) {
                custom_config = { type: 'unknown', size: 'Không có thông tin', notes: order.customer_note || '', images: [] };
            } else if (order.order_type === 'printing' && config) {
                printing_config = {
                    type: config.print_tech,
                    color: config.color,
                    quantity: config.quantity,
                    analysis: { grams: config.print_weight, hours: config.print_time, price: order.subtotal },
                    notes: order.customer_note,
                    files: (order.order_files || [])
                        .filter((f: { file_type: string }) => f.file_type === 'stl')
                        .map((f: { file_id: string; file_name: string | null }) => ({
                            url: `https://drive.google.com/file/d/${f.file_id}/view`,
                            name: f.file_name || 'file.stl',
                        })),
                };
            } else if (order.order_type === 'printing' && !config && order.printing_config) {
                printing_config = order.printing_config;
            }

            const shippingAddress = order.addresses || order.shipping_address || null;

            return this.handleSuccess({
                order: { ...order, custom_config, printing_config, shipping_address: shippingAddress, source: 'orders' },
                profile: order.profiles,
            });
        }, 'AdminOrderController.getOrder');
    }

    /**
     * PUT /api/admin/orders/[id]
     * Update order with status timestamps and auto-archive (admin only)
     */
    async updateOrder(request: NextRequest, orderId: string) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            const body = await request.json();

            // Try order_child table first
            const { data: childOrder } = await supabaseAdmin
                .from('order_child')
                .select('id, status')
                .eq('id', orderId)
                .maybeSingle();

            if (childOrder) {
                // Update order_child table
                const childUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
                if (body.status) childUpdates.status = body.status;

                const { error } = await supabaseAdmin
                    .from('order_child')
                    .update(childUpdates)
                    .eq('id', orderId);

                if (error) throw error;
                return this.handleSuccess({ success: true });
            }

            // Fallback to orders table
            const { data: existingOrder } = await supabaseAdmin
                .from('orders')
                .select('id, status')
                .eq('id', orderId)
                .maybeSingle();

            if (!existingOrder) throw new NotFoundError('Order not found');

            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

            // Handle status with timestamps
            if (body.status) {
                const validStatuses = [
                    'pending', 'expired', 'paid', 'confirmed', 'preparing', 'processing',
                    'designing', 'review', 'revising', 'approved', 'producing',
                    'printing', 'completed', 'shipped', 'shipping', 'delivered', 'cancelled', 'refunded'
                ];
                if (validStatuses.includes(body.status)) {
                    updates.status = body.status;
                    const now = new Date().toISOString();
                    const timestampMap: Record<string, string> = {
                        paid: 'paid_at', confirmed: 'paid_at', preparing: 'processing_at', processing: 'processing_at',
                        designing: 'designing_at', review: 'review_at', revising: 'revising_at', approved: 'approved_at',
                        producing: 'producing_at', printing: 'printing_at', shipped: 'shipped_at', shipping: 'shipped_at',
                        delivered: 'delivered_at',
                    };
                    if (timestampMap[body.status]) updates[timestampMap[body.status]] = now;
                }
            }

            if (body.admin_note !== undefined) updates.admin_note = body.admin_note?.slice(0, 500) || null;
            if (body.shipping_code !== undefined) updates.shipping_code = body.shipping_code?.slice(0, 30) || null;
            if (body.shipping_status !== undefined) updates.shipping_status = body.shipping_status?.slice(0, 20) || null;

            const { error } = await supabaseAdmin.from('orders').update(updates).eq('id', orderId);
            if (error) throw error;

            // Auto-archive on completion
            if (body.status === 'delivered' || body.status === 'completed') {
                this.triggerArchive(orderId, request.headers.get('cookie') || '');
            }

            return this.handleSuccess({ success: true });
        }, 'AdminOrderController.updateOrder');
    }

    /**
     * Trigger archive API (non-blocking)
     */
    private async triggerArchive(orderId: string, cookie: string) {
        try {
            const archiveUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/orders/${orderId}/archive`;
            await fetch(archiveUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
            });
        } catch (e) {
            console.error('[Archive] Failed:', e);
        }
    }

    // ==========================================================================
    // Private Helpers
    // ==========================================================================

    private async getOrdersWithProfiles(orderType: string, page: number, limit: number) {
        // Query from order_child table (new direct orders)
        const { data: childOrders, error: childError } = await supabaseAdmin
            .from('order_child')
            .select('*')
            .order('created_at', { ascending: false });

        if (childError) {
            console.error('[AdminOrders] Failed to fetch order_child:', childError);
        }

        // Query from legacy orders table
        let legacyQuery = supabaseAdmin
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (orderType !== 'all') {
            legacyQuery = legacyQuery.eq('order_type', orderType);
        }

        const { data: legacyOrders, error: legacyError } = await legacyQuery;

        if (legacyError) {
            console.error('[AdminOrders] Failed to fetch orders:', legacyError);
        }

        // Transform child orders to unified format
        const transformedChildOrders = (childOrders || []).map(order => ({
            id: order.id,
            order_code: order.code_child,
            order_type: order.product_type || 'product',
            user_id: order.user_id,
            status: order.status,
            subtotal: order.total_price,
            total: order.total_price,
            product_name: order.product_name,
            quantity: order.quantity,
            unit_price: order.unit_price,
            payment_qr_url: order.payment_qr_url,
            metadata: order.metadata,
            created_at: order.created_at,
            updated_at: order.updated_at,
            source: 'order_child' as const,
        }));

        // Transform legacy orders
        const transformedLegacyOrders = (legacyOrders || []).map(order => ({
            ...order,
            source: 'orders' as const,
        }));

        // Merge and sort by created_at
        const allOrders = [...transformedChildOrders, ...transformedLegacyOrders]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Apply pagination manually after merge
        const total = allOrders.length;
        const paginatedOrders = allOrders.slice((page - 1) * limit, page * limit);

        // Get profiles for all orders
        const userIds = [...new Set(paginatedOrders.map(o => o.user_id).filter(Boolean))] as string[];
        let profileMap: Record<string, unknown> = {};

        if (userIds.length > 0) {
            const { data: profiles } = await supabaseAdmin
                .from('profiles')
                .select('id, full_name, email, phone, instagram_username')
                .in('id', userIds);

            if (profiles) {
                profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
            }
        }

        const ordersWithProfiles = paginatedOrders.map(order => ({
            ...order,
            profiles: order.user_id && profileMap[order.user_id] ? profileMap[order.user_id] : null,
        }));

        return { orders: ordersWithProfiles, total, page, limit };
    }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const adminOrderController = new AdminOrderController();
