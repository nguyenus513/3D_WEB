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
import { parseOrderStorageKey } from '@/lib/storage/order-storage';

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
     * List all orders from ALL tables (orders, custom_orders, print_orders)
     * Note: Pagination is approximate due to multi-table merge.
     */
    async listOrders(request: NextRequest) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            const { searchParams } = new URL(request.url);
            const status = searchParams.get('status');
            const type = searchParams.get('type');
            const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
            const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
            const start = (page - 1) * limit;
            const end = start + limit - 1;

            // Unified Query
            let query = this.supabase
                .from('orders')
                .select('*, user:profiles(id, full_name, email, phone, customer_code)', { count: 'exact' })
                .order('created_at', { ascending: false });

            if (status && status !== 'all') {
                query = query.eq('status', status);
            }
            if (type && type !== 'all') {
                query = query.eq('order_type', type);
            }

            const { data, count, error } = await query.range(start, end);

            if (error) {
                console.error('Error fetching orders:', error);
                throw error;
            }

            const orders = (data || []) as any[];

            // Transform for Frontend
            const mappedOrders = orders.map(o => {
                // Determine display type and items
                const type = o.order_type || 'ready_made';
                let displayItems = o.items || [];

                // If items missing in relation but config exists, synthesize it (Migration fallback)
                if (displayItems.length === 0) {
                    if (type === 'custom' && (o.custom_config || o.items_config?.custom)) {
                        const cfg = o.custom_config || o.items_config?.custom;
                        displayItems = [{
                            name: 'Custom Order',
                            quantity: 1,
                            unit_price: o.total_amount,
                            total_price: o.total_amount,
                            configuration: cfg
                        }];
                    } else if (type === 'printing' && (o.printing_config || o.items_config?.printing)) {
                        const cfg = o.printing_config || o.items_config?.printing;
                        displayItems = [{
                            name: `3D Print (${cfg.type || 'Custom'})`,
                            quantity: 1,
                            unit_price: o.total_amount,
                            total_price: o.total_amount,
                            configuration: cfg
                        }];
                    }
                }

                return {
                    ...o,
                    profiles: o.user, // Frontend expects 'profiles' key
                    total: o.total_amount, // Frontend expects 'total'
                    order_items: displayItems,
                    order_type: type,
                    _source_table: 'orders'
                };
            });

            return this.handleSuccess({
                orders: mappedOrders,
                total: count || 0,
                page,
                limit
            });

        }, 'AdminOrderController.listOrders');
    }

    /**
     * GET /api/admin/orders/[id]
     * Get single order by ID from Unified orders table
     */
    async getOrder(request: NextRequest, orderId: string) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            const { data: order, error } = await this.supabase
                .from('orders')
                .select(`
                    *,
                    user:profiles(*)
                `)
                .eq('id', orderId)
                .maybeSingle();

            if (!order) {
                throw new NotFoundError('Order not found');
            }

            const orderData = order as any;

            // Map unified order to frontend-expected structure
            const type = orderData.order_type || 'ready_made';
            let mappedOrder = {
                ...orderData,
                profiles: orderData.user,
                order_items: orderData.items || [],
                total: orderData.total_amount,
                order_type: type,
                // Standardize notes
                customer_note: orderData.notes,
                admin_note: orderData.admin_notes,
                // Configs
                custom_config: orderData.custom_config || (orderData.items_config?.custom),
                printing_config: orderData.printing_config || (orderData.items_config?.printing),
                shipping_address: orderData.shipping_address_snapshot,
                _source_table: 'orders'
            };

            // Ensure order_items has content for custom/print types if empty
            if (mappedOrder.order_items.length === 0) {
                if (type === 'custom') {
                    mappedOrder.order_items = [{
                        name: 'Custom Order',
                        quantity: 1,
                        total_price: orderData.total_amount,
                        unit_price: orderData.total_amount,
                        // Inject config for UI that looks at item config
                        configuration: mappedOrder.custom_config
                    }];
                } else if (type === 'printing') {
                    mappedOrder.order_items = [{
                        name: '3D Print Service',
                        quantity: 1,
                        total_price: orderData.total_amount,
                        unit_price: orderData.total_amount,
                        configuration: mappedOrder.printing_config
                    }];
                }
            }

            const { data: fileRows } = await this.supabase
                .from('order_files')
                .select('file_key, file_name, storage_provider, drive_url, archived_at')
                .eq('order_id', orderId);

            const files = (fileRows || []).filter((f: any) => f.file_key);
            const customImages: Array<{ url: string; thumbnail: string; name: string; key: string; storage_provider?: string }> = [];
            const printingFiles: Array<{ url: string; name: string; key: string; storage_provider?: string }> = [];
            const reviewFiles: Array<{ url: string; name: string; key: string; storage_provider?: string }> = [];

            files.forEach((file: any) => {
                const key = file.file_key as string;
                const parsed = parseOrderStorageKey(key);
                if (!parsed) return;
                const url = (file.storage_provider === 'drive' && file.drive_url)
                    ? file.drive_url
                    : `/api/files/${key}`;
                const name = file.file_name || parsed.fileName || key.split('/').pop() || 'file';

                if (parsed.category.startsWith('custom_')) {
                    customImages.push({ url, thumbnail: url, name, key, storage_provider: file.storage_provider });
                } else if (parsed.category.startsWith('printing_')) {
                    printingFiles.push({ url, name, key, storage_provider: file.storage_provider });
                } else if (parsed.category === 'review') {
                    reviewFiles.push({ url, name, key, storage_provider: file.storage_provider });
                }
            });

            if (type === 'custom') {
                mappedOrder.custom_config = { ...(mappedOrder.custom_config || {}), images: customImages };
            }
            if (type === 'printing') {
                const analysisSummary = (mappedOrder.order_items || []).reduce((sum: { grams: number; hours: number; price: number; volume?: number }, item: any) => {
                    const analysis = item?.configuration?.analysis || {};
                    const qty = Number(item.quantity || 1);
                    return {
                        grams: sum.grams + Number(analysis.grams || 0) * qty,
                        hours: sum.hours + Number(analysis.hours || 0) * qty,
                        price: sum.price + Number(item.total_price || 0),
                        volume: (sum.volume || 0) + Number(analysis.volume || 0) * qty,
                    };
                }, { grams: 0, hours: 0, price: 0, volume: 0 });

                mappedOrder.printing_config = {
                    ...(mappedOrder.printing_config || {}),
                    files: printingFiles,
                    analysis: analysisSummary,
                };
            }
            if (reviewFiles.length > 0) {
                mappedOrder.demo_image_url = reviewFiles[0].url;
            }

            return this.handleSuccess({
                order: mappedOrder,
                profile: orderData.user
            });
        }, 'AdminOrderController.getOrder');
    }

    /**
     * PUT /api/admin/orders/[id]
     * Update order status and fields - Unified Table
     */
    async updateOrder(request: NextRequest, orderId: string) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            const body = await request.json();
            const { data: existingOrder } = await this.supabase
                .from('orders')
                .select('id, status, order_type, payment_status, deposit_paid')
                .eq('id', orderId)
                .maybeSingle();

            if (!existingOrder) {
                throw new NotFoundError('Order not found');
            }

            const updateData: Record<string, unknown> = {
                updated_at: new Date().toISOString()
            };

            const requestedStatus = body.status;
            const requestedPaymentStatus = body.payment_status;

            if (requestedStatus) {
                if (requestedStatus === 'paid') {
                    // Legacy status value - map to payment_status + confirmed
                    updateData.payment_status = 'paid';
                    if (['pending', 'pending_confirmation'].includes(existingOrder.status)) {
                        updateData.status = 'confirmed';
                        updateData.confirmed_at = new Date().toISOString();
                    }
                } else {
                    updateData.status = requestedStatus;
                    if (requestedStatus === 'confirmed') {
                        updateData.confirmed_at = new Date().toISOString();
                    }
                    if (requestedStatus === 'delivered') {
                        updateData.payment_status = updateData.payment_status || 'paid';
                        updateData.paid_at = new Date().toISOString();
                        updateData.delivered_at = updateData.delivered_at || new Date().toISOString();
                        updateData.completed_at = updateData.completed_at || new Date().toISOString();
                    }
                    if (requestedStatus === 'completed') {
                        updateData.payment_status = updateData.payment_status || 'paid';
                        updateData.paid_at = updateData.paid_at || new Date().toISOString();
                        updateData.completed_at = updateData.completed_at || new Date().toISOString();
                    }
                }
            }

            if (requestedPaymentStatus) {
                updateData.payment_status = requestedPaymentStatus;
                if (requestedPaymentStatus === 'paid') {
                    updateData.paid_at = updateData.paid_at || new Date().toISOString();
                    if (['pending', 'pending_confirmation'].includes(existingOrder.status)) {
                        updateData.status = updateData.status || 'confirmed';
                        updateData.confirmed_at = new Date().toISOString();
                    }
                }
            }

            if (body.deposit_paid !== undefined) updateData.deposit_paid = body.deposit_paid;
            if (body.paid_at) updateData.paid_at = body.paid_at;
            const timestampFields = [
                'confirmed_at',
                'processing_at',
                'designing_at',
                'review_at',
                'revising_at',
                'approved_at',
                'producing_at',
                'printing_at',
                'shipped_at',
                'delivered_at',
            ];
            timestampFields.forEach((field) => {
                if (body[field] !== undefined) {
                    updateData[field] = body[field];
                }
            });

            // Notes: accept both admin_note and admin_notes
            if (body.admin_notes !== undefined) updateData.admin_notes = body.admin_notes;
            if (body.admin_note !== undefined && updateData.admin_notes === undefined) {
                updateData.admin_notes = body.admin_note;
            }
            if (body.notes !== undefined) updateData.notes = body.notes;

            if (body.shipping_code) updateData.shipping_code = body.shipping_code;
            if (body.shipping_address_snapshot) updateData.shipping_address_snapshot = body.shipping_address_snapshot;

            const { data, error } = await this.supabase
                .from('orders')
                .update(updateData)
                .eq('id', orderId)
                .select()
                .single();

            if (error) {
                console.error('[AdminOrder] Update error:', error);
                throw error;
            }

            return this.handleSuccess({ success: true, order: data });

        }, 'AdminOrderController.updateOrder');
    }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const adminOrderController = new AdminOrderController();
