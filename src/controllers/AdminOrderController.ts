/**
 * Admin Order Controller
 *
 * Request handling layer for admin order management APIs.
 * Updated for Schema V6 (Unified Orders - single `orders` table).
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BaseController, UnauthorizedError, NotFoundError } from '@/lib/core/BaseController';
import { config } from '@/config/unifiedConfig';
import { requireAdmin } from '@/lib/security/admin-guard';

// =============================================================================
// Allowed update fields (whitelist to prevent injection of invalid columns)
// =============================================================================
const ALLOWED_UPDATE_FIELDS: ReadonlySet<string> = new Set([
    'status',
    'payment_status',
    'deposit_paid',
    'paid_at',
    'shipping_code',
    'admin_notes',
    'demo_image_url',
    'demo_version',
    'revision_feedback',
]);

// =============================================================================
// Admin Order Controller
// =============================================================================

export class AdminOrderController extends BaseController {

    private _supabase: ReturnType<typeof createClient> | null = null;

    /**
     * Lazy initialize Supabase Admin Client
     * Prevents startup crashes if env vars are missing during build/init
     */
    private get supabase() {
        if (!this._supabase) {
            this._supabase = createClient(
                config.supabase.url,
                config.supabase.serviceRoleKey,
                { auth: { persistSession: false } }
            );
        }
        return this._supabase;
    }

    /**
     * GET /api/admin/orders
     * List all orders from the unified `orders` table.
     */
    async listOrders(request: NextRequest) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            const { searchParams } = new URL(request.url);
            const status = searchParams.get('status');
            const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
            const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
            const start = (page - 1) * limit;
            const end = start + limit - 1;

            // Query unified orders table
            let query = this.supabase
                .from('orders')
                .select('*, user:profiles(id, full_name, email, phone, customer_code), items:order_items(*)', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(start, end);

            if (status && status !== 'all') {
                query = query.eq('status', status);
            }

            const { data: orders, error, count } = await query;

            if (error) {
                console.error('[AdminOrder] listOrders error:', error.message);
                throw new Error(`Failed to list orders: ${error.message}`);
            }

            // Transform to expected frontend format
            const transformedOrders = (orders || []).map((o: any) => ({
                ...o,
                profiles: o.user,
                total: o.total_amount,
                order_items: o.items,
                order_type: o.order_type || this.inferOrderType(o.items),
                _source_table: 'orders'
            }));

            return this.handleSuccess({
                orders: transformedOrders,
                total: count ?? transformedOrders.length,
                page,
                limit
            });
        }, 'AdminOrderController.listOrders');
    }

    /**
     * GET /api/admin/orders/[id]
     * Get single order by ID from the unified `orders` table.
     */
    async getOrder(request: NextRequest, orderId: string) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            console.log('[AdminOrder] getOrder - Looking for orderId:', orderId);

            const { data: order, error } = await this.supabase
                .from('orders')
                .select(`*, user:profiles(*), items:order_items(*)`)
                .eq('id', orderId)
                .maybeSingle() as any;

            if (error) {
                console.error('[AdminOrder] getOrder error:', error.message);
                throw new Error(`Failed to fetch order: ${error.message}`);
            }

            if (!order) {
                throw new NotFoundError(`Order ${orderId} not found`);
            }

            // Map to frontend structure
            const items = Array.isArray(order.items) ? order.items : [];
            const mainItem = items[0] || {};
            const itemConfig = mainItem.configuration || mainItem.spec || {};
            const orderType = order.order_type || this.inferOrderType(items);

            let custom_config = null;
            if (orderType === 'custom') {
                custom_config = {
                    type: itemConfig.type || itemConfig.style || 'unknown',
                    size: itemConfig.size || mainItem?.size || 'Chưa chọn',
                    notes: order.notes || '',
                    images: (Array.isArray(itemConfig.photos) ? itemConfig.photos : []).map((p: any) => ({
                        id: p.drive_file_id || p.id,
                        name: p.file_name || p.name,
                        url: p.web_view_link || p.url,
                        thumbnail: p.thumbnail
                    })),
                };
            }

            let printing_config = null;
            if (orderType === 'printing') {
                printing_config = {
                    type: itemConfig.print_tech || itemConfig.type,
                    color: itemConfig.color,
                    file_url: itemConfig.file_url,
                };
            }

            return this.handleSuccess({
                order: {
                    ...order,
                    profiles: order.user,
                    order_items: order.items,
                    total: order.total_amount,
                    customer_note: order.notes,
                    admin_note: order.admin_notes,
                    order_type: orderType,
                    custom_config,
                    printing_config,
                    shipping_address: order.shipping_address || order.shipping_address_snapshot,
                    _source_table: 'orders'
                },
                profile: order.user,
            });
        }, 'AdminOrderController.getOrder');
    }

    /**
     * PUT /api/admin/orders/[id]
     * Update order - unified `orders` table only.
     */
    async updateOrder(request: NextRequest, orderId: string) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            const body = await request.json();
            console.log('[AdminOrder] Update request:', { orderId, body });

            // Build update object from whitelist only
            const update: Record<string, unknown> = {};

            // Status
            if (body.status !== undefined && body.status !== null) {
                update.status = body.status;
            }

            // Payment fields
            if (body.deposit_paid !== undefined) update.deposit_paid = body.deposit_paid;
            if (body.paid_at !== undefined) update.paid_at = body.paid_at;
            if (body.payment_status !== undefined) update.payment_status = body.payment_status;

            // Shipping
            if (body.shipping_code !== undefined) update.shipping_code = body.shipping_code;

            // Admin notes (frontend sends `admin_note`, DB column is `admin_notes`)
            if (body.admin_note !== undefined) {
                update.admin_notes = body.admin_note;
            }

            // Demo fields
            if (body.demo_image_url !== undefined) update.demo_image_url = body.demo_image_url;
            if (body.demo_version !== undefined) update.demo_version = body.demo_version;
            if (body.revision_feedback !== undefined) update.revision_feedback = body.revision_feedback;

            // When confirming deposit, also update payment_status
            if (body.deposit_paid === true && !body.payment_status) {
                update.payment_status = 'confirmed';
            }

            // Auto-complete payment on Delivery/Completion
            if (body.status === 'delivered' || body.status === 'completed') {
                update.payment_status = 'paid';
                if (!update.paid_at) update.paid_at = new Date().toISOString();
                console.log('[AdminOrder] Auto-completing payment for delivery');
            }

            // If no fields to update, return early
            if (Object.keys(update).length === 0) {
                console.warn('[AdminOrder] No valid fields to update. Body:', body);
                return this.handleSuccess({ success: true, message: 'No fields to update', updatedFields: [] as string[] });
            }

            console.log('[AdminOrder] Updating orders table for ID:', orderId, 'Fields:', update);

            // Retry loop: handle missing columns (PGRST204) by removing them and retrying
            let attemptUpdate = { ...update };
            const removedFields: string[] = [];
            const MAX_RETRIES = 5;

            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                if (Object.keys(attemptUpdate).length === 0) {
                    // All fields were removed due to missing columns — only status matters
                    console.warn('[AdminOrder] All update fields removed due to missing DB columns:', removedFields);
                    break;
                }

                const { data, error } = await (this.supabase
                    .from('orders') as any)
                    .update(attemptUpdate)
                    .eq('id', orderId)
                    .select('id, status')
                    .maybeSingle();

                if (error) {
                    // PGRST204 = column not found in schema cache
                    if (error.code === 'PGRST204') {
                        // Extract column name from error: "Could not find the 'COLUMN' column..."
                        const match = error.message.match(/Could not find the '(\w+)' column/);
                        if (match) {
                            const missingCol = match[1];
                            console.warn(`[AdminOrder] Column '${missingCol}' missing from orders table, removing and retrying`);
                            delete attemptUpdate[missingCol];
                            removedFields.push(missingCol);
                            continue; // Retry without this column
                        }
                    }

                    console.error('[AdminOrder] Update error:', error.message, '(Code:', error.code, ')');
                    throw new Error(`Failed to update order: ${error.message}`);
                }

                if (!data) {
                    console.error(`[AdminOrder] No order found with ID ${orderId} in orders table`);
                    throw new NotFoundError(`Order ${orderId} not found in orders table`);
                }

                console.log('[AdminOrder] ✓ Updated order:', data.id, 'Status:', data.status);
                if (removedFields.length > 0) {
                    console.warn('[AdminOrder] Skipped missing columns:', removedFields.join(', '));
                }

                return this.handleSuccess({
                    success: true,
                    message: 'Order updated successfully',
                    updatedFields: Object.keys(attemptUpdate),
                });
            }

            // If we exhausted retries, try status-only update as last resort
            if (update.status) {
                console.log('[AdminOrder] Fallback: updating status only');
                const { data, error } = await (this.supabase
                    .from('orders') as any)
                    .update({ status: update.status })
                    .eq('id', orderId)
                    .select('id, status')
                    .maybeSingle();

                if (!error && data) {
                    return this.handleSuccess({
                        success: true,
                        message: 'Order status updated (some fields skipped due to missing columns)',
                        updatedFields: ['status'],
                    });
                }
            }

            throw new NotFoundError(`Order ${orderId} not found or update failed`);
        }, 'AdminOrderController.updateOrder');
    }

    /**
     * Infer order type from order items configuration
     */
    private inferOrderType(items: any[]): string {
        try {
            if (!Array.isArray(items) || items.length === 0) return 'ready_made';

            const first = items[0];
            if (!first) return 'ready_made';

            // Check item_type first (most reliable)
            if (first.item_type === 'custom') return 'custom';
            if (first.item_type === 'printing') return 'printing';

            // Fallback: check configuration object
            const itemConfig = first.configuration || {};
            if (itemConfig.print_tech) return 'printing';
            if (itemConfig.style || (Array.isArray(itemConfig.photos) && itemConfig.photos.length > 0)) return 'custom';

            return 'ready_made';
        } catch (e) {
            console.error('Error inferring order type:', e);
            return 'ready_made';
        }
    }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const adminOrderController = new AdminOrderController();
