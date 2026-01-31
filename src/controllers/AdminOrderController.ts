/**
 * Admin Order Controller
 *
 * Request handling layer for admin order management APIs.
 * Updated for Schema V3 (Unified Orders).
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BaseController, UnauthorizedError, NotFoundError } from '@/lib/core/BaseController';
import { config } from '@/config/unifiedConfig';
import { requireAdmin } from '@/lib/security/admin-guard';

// =============================================================================
// Supabase Admin Client
// =============================================================================

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
     * List all orders with profile data (admin only)
     */
    async listOrders(request: NextRequest) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            const { searchParams } = new URL(request.url);
            // orderType is not strictly supported in V3 schema columns, but we can filter by item type if needed.
            const status = searchParams.get('status');
            const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
            const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
            const start = (page - 1) * limit;
            const end = start + limit - 1;

            let query = this.supabase
                .from('orders')
                .select('*, user:profiles(id, full_name, email, phone, customer_code), items:order_items(*)', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(start, end);

            if (status && status !== 'all') {
                query = query.eq('status', status);
            }

            const { data: orders, count, error } = await query as any;

            if (error) {
                console.error('[AdminOrderController.listOrders] DB Error:', error);
                throw error;
            }

            // Transform to frontend format
            const transformedOrders = (orders || []).map((order: any) => ({
                ...order,
                profiles: order.user, // Map user relation to profiles field
                total: order.total_amount, // Map total_amount to total
                order_items: order.items,
                // Infer legacy order_type for frontend compatibility
                order_type: this.inferOrderType(order.items),
            }));

            return this.handleSuccess({
                orders: transformedOrders,
                total: count || 0,
                page,
                limit
            });
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

            const { data: order, error } = await this.supabase
                .from('orders')
                .select(`
                    *,
                    user:profiles(id, full_name, email, phone, customer_code),
                    items:order_items(*),
                    address:addresses(*)
                `)
                .eq('id', orderId)
                .single() as any;

            if (error || !order) {
                if (error) console.error('[AdminOrderController.getOrder] DB Error:', error);
                throw new NotFoundError('Order not found');
            }

            // Map to legacy structure for frontend compatibility
            // Infer configs from the first item (assuming single main item per order for custom/printing usually)
            // Safety: order.items can be null if join fails or empty array
            const items = Array.isArray(order.items) ? order.items : [];
            const mainItem = items[0] || {};
            const config = mainItem.configuration || {};

            const orderType = this.inferOrderType(items);

            let custom_config = null;
            let printing_config = null;

            if (orderType === 'custom') {
                custom_config = {
                    type: config.type || 'unknown',
                    size: config.size || mainItem?.size || 'Chưa chọn',
                    notes: order.notes || '', // Map notes
                    images: (Array.isArray(config.photos) ? config.photos : []).map((p: any) => ({
                        id: p.drive_file_id || p.id,
                        name: p.file_name || p.name,
                        url: p.web_view_link || p.url || (p.drive_file_id ? `https://drive.google.com/file/d/${p.drive_file_id}/view` : ''),
                        thumbnail: p.thumbnail || (p.drive_file_id ? `https://drive.google.com/thumbnail?id=${p.drive_file_id}&sz=w400` : '')
                    })),
                };
            } else if (orderType === 'printing') {
                printing_config = {
                    type: config.print_tech,
                    color: config.color,
                    quantity: mainItem.quantity || 1,
                    analysis: {
                        grams: config.grams || 0,
                        hours: config.hours || 0,
                        price: mainItem.total_price || 0
                    },
                    files: config.file_url ? [{ url: config.file_url, name: config.file_name }] : [],
                    notes: order.notes || '',
                };
            }

            const shippingAddress = order.shipping_address_snapshot || null;

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
                    shipping_address: shippingAddress,
                    shipping_code: order.metadata?.shipping_code || null,
                },
                profile: order.user,
            });
        }, 'AdminOrderController.getOrder');
    }

    /**
     * PUT /api/admin/orders/[id]
     * Update order with status timestamps
     */
    async updateOrder(request: NextRequest, orderId: string) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            const body = await request.json();
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

            if (body.status) {
                updates.status = body.status;
                const now = new Date().toISOString();
                // Map status to timestamp fields
                const timestampMap: Record<string, string> = {
                    paid: 'paid_at', confirmed: 'confirmed_at',
                    processing: 'processing_at', designing: 'designing_at',
                    review: 'review_at', revising: 'revising_at',
                    approved: 'approved_at', producing: 'producing_at',
                    printing: 'producing_at', // Map printing -> producing_at
                    shipping: 'shipped_at', shipped: 'shipped_at',
                    delivered: 'delivered_at', completed: 'completed_at'
                };

                // Only update timestamp if key exists in map AND commonly used columns
                // We should check if these columns exist in DB, but for now we trust schema V3 has main ones
                if (timestampMap[body.status] && ['confirmed_at', 'paid_at', 'completed_at'].includes(timestampMap[body.status])) {
                    updates[timestampMap[body.status]] = now;
                }
            }

            if (body.admin_note !== undefined) updates.admin_notes = body.admin_note;

            // Handle shipping_code in metadata
            if (body.shipping_code !== undefined) {
                const { data } = await this.supabase
                    .from('orders')
                    .select('metadata')
                    .eq('id', orderId)
                    .single() as any;

                const currentMeta = data?.metadata || {};
                updates.metadata = { ...currentMeta, shipping_code: body.shipping_code };
            }

            if (body.deposit_paid !== undefined) {
                // Update payment_status if deposit is paid
                if (body.deposit_paid) updates.payment_status = 'partial'; // or 'paid'
            }

            const { error } = await (this.supabase.from('orders') as any).update(updates).eq('id', orderId);
            if (error) {
                console.error('[AdminOrderController.updateOrder] DB Error:', error);
                throw error;
            }

            return this.handleSuccess({ success: true });
        }, 'AdminOrderController.updateOrder');
    }

    private inferOrderType(items: any[]): string {
        try {
            if (!Array.isArray(items) || items.length === 0) return 'ready_made';

            // Check first item config or product type if available
            const first = items[0];
            if (!first) return 'ready_made';

            // Safety check for configuration object
            const config = first.configuration || {};

            if (config.print_tech) return 'printing';
            if (config.style || (Array.isArray(config.photos) && config.photos.length > 0)) return 'custom';

            return 'ready_made';
        } catch (e) {
            console.error('Error inferring order type:', e);
            return 'ready_made'; // Fallback to safe default
        }
    }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const adminOrderController = new AdminOrderController();
