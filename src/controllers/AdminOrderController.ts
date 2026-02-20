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

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';

/**
 * Resolve file_url (R2 key, proxy path, or full URL) to a usable URL.
 * - Full URL (http/https): return as-is
 * - Proxy path (/api/files/...): return as-is
 * - Raw R2 key: prepend /api/files/ for secure proxy access
 */
function resolveFileUrl(fileUrl: string, provider?: string): string {
    if (!fileUrl) return '';
    // Already a full URL
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
        return fileUrl;
    }
    // Already a proxy path
    if (fileUrl.startsWith('/api/files/')) {
        return fileUrl;
    }
    // Raw R2 key — serve via proxy (e.g. "KH-xxx/2026-02-19/xxx/xxx.jpg")
    if (provider === 'r2' || !fileUrl.startsWith('/')) {
        return `/api/files/${fileUrl}`;
    }
    // Fallback
    return fileUrl;
}

// =============================================================================
// Allowed update fields (whitelist to prevent injection of invalid columns)
// =============================================================================
const ALLOWED_UPDATE_FIELDS: ReadonlySet<string> = new Set([
    'status',
    'payment_status',
    'paid_at',
    'shipping_code',
    'admin_notes',
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
            const { authorized, response: authResponse } = await requireAdmin(request);
            if (!authorized) return authResponse as any;

            const { searchParams } = new URL(request.url);
            const status = searchParams.get('status');
            const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
            const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
            const start = (page - 1) * limit;
            const end = start + limit - 1;

            // Query unified orders table — join users AND user_profiles for full_name
            let query = this.supabase
                .from('orders')
                .select('*, user:users(id, name, email, phone, customer_code, profile:user_profiles(full_name, phone)), items:order_items(*)', { count: 'exact' })
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
                profiles: o.user ? {
                    ...o.user,
                    // full_name: prefer user_profiles.full_name, fallback to users.name
                    full_name: o.user.profile?.full_name || o.user.name || null,
                    phone: o.user.profile?.phone || o.user.phone || null,
                } : null,
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
            const { authorized, response: authResponse } = await requireAdmin(request);
            if (!authorized) return authResponse as any;

            console.log('[AdminOrder] getOrder - Looking for orderId:', orderId);

            const { data: order, error } = await this.supabase
                .from('orders')
                .select(`*, user:users(*, profile:user_profiles(full_name, phone)), items:order_items(*, print_job:print_jobs(*))`)
                .eq('id', orderId)
                .maybeSingle() as any;

            if (error) {
                console.error('[AdminOrder] getOrder error:', error.message);
                throw new Error(`Failed to fetch order: ${error.message}`);
            }

            if (!order) {
                throw new NotFoundError(`Order ${orderId} not found`);
            }

            // Fetch file_links separately (polymorphic ref_type/ref_id, no FK)
            // Files may be linked to the order OR to individual order_items
            const itemIds = (Array.isArray(order.items) ? order.items : []).map((i: any) => i.id).filter(Boolean);
            const allRefIds = [orderId, ...itemIds];
            const { data: fileLinks } = await this.supabase
                .from('file_links')
                .select('*, file:files(*)')
                .in('ref_id', allRefIds);

            // Map to frontend structure
            const items = Array.isArray(order.items) ? order.items : [];
            const mainItem = items[0] || {};
            const itemConfig = mainItem.configuration || {};
            const rawOrderType = order.order_type || this.inferOrderType(items);
            // Normalize order type: treat 'print_3d' as 'printing' for frontend
            const orderType = rawOrderType === 'print_3d' ? 'printing' : rawOrderType;

            // Map file_links for admin consumption
            // files table columns: id, file_url, mime_type, size_bytes, provider, created_at
            const orderFiles = Array.isArray(fileLinks) ? fileLinks.map((fl: any) => {
                const f = fl.file || {};
                // Extract a display name from file_url (last segment or drive ID)
                const fileUrl = f.file_url || '';
                const displayName = fileUrl.split('/').pop() || fileUrl || 'unknown';
                return {
                    id: fl.id,
                    file_id: fl.file_id,
                    // Map order_item ref to order_item_id for frontend matching
                    order_item_id: fl.ref_type === 'order_item' ? fl.ref_id : null,
                    file_name: displayName,
                    file_key: f.file_url,       // file_url serves as the key/path
                    file_type: f.mime_type,
                    file_url: resolveFileUrl(f.file_url, f.provider),
                    tag: fl.tag,
                    ref_type: fl.ref_type,
                    storage_provider: f.provider,
                    size_bytes: f.size_bytes,
                    created_at: fl.created_at,
                };
            }) : [];

            let custom_config = null;
            if (orderType === 'custom') {
                // Map images from either legacy itemConfig.photos OR new orderFiles (file_links)
                const legacyPhotos = Array.isArray(itemConfig.photos) ? itemConfig.photos : [];
                const images = legacyPhotos.length > 0
                    ? legacyPhotos.map((p: any) => ({
                        id: p.drive_file_id || p.id,
                        name: p.file_name || p.name,
                        url: p.web_view_link || p.url,
                        thumbnail: p.thumbnail
                    }))
                    : orderFiles.map((f: any) => ({
                        id: f.id,
                        name: f.file_name,
                        url: f.file_url, // Already resolved by orderFiles mapping
                        thumbnail: null
                    }));

                custom_config = {
                    type: itemConfig.type || (mainItem.configuration as any)?.type || 'unknown',
                    size: itemConfig.size || (mainItem.configuration as any)?.size || 'Chưa chọn',
                    notes: order.notes || (mainItem.configuration as any)?.notes || '',
                    images,
                };
            }

            // Printing config: per-item print specs
            let printing_config = null;
            if (orderType === 'printing' || rawOrderType === 'print_3d') {
                const totalQuantity = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
                printing_config = {
                    quantity: totalQuantity,
                    notes: order.notes || '',
                };
            }

            // Build profile with full_name resolution
            const resolvedProfile = order.user ? {
                ...order.user,
                full_name: order.user.profile?.full_name || order.user.name || null,
                phone: order.user.profile?.phone || order.user.phone || null,
            } : null;

            return this.handleSuccess({
                order: {
                    ...order,
                    profiles: resolvedProfile,
                    order_items: order.items,
                    order_files: orderFiles,
                    total: order.total_amount,
                    customer_note: order.notes,
                    admin_note: order.admin_notes,
                    order_type: orderType,
                    custom_config,
                    printing_config,
                    shipping_address: order.shipping_address || order.shipping_address_snapshot,
                    _source_table: 'orders'
                },
                profile: resolvedProfile,
            });
        }, 'AdminOrderController.getOrder');
    }

    /**
     * PUT /api/admin/orders/[id]
     * Update order - unified `orders` table only.
     */
    async updateOrder(request: NextRequest, orderId: string) {
        return this.wrapHandler(async () => {
            const { authorized, response: authResponse } = await requireAdmin(request);
            if (!authorized) return authResponse as any;

            const body = await request.json();
            console.log('[AdminOrder] Update request:', { orderId, body });

            // Build update object from whitelist only
            const update: Record<string, unknown> = {};

            // Status
            if (body.status !== undefined && body.status !== null) {
                update.status = body.status;
            }

            // Payment fields (deposit_paid column removed — derive payment_status instead)
            if (body.paid_at !== undefined) update.paid_at = body.paid_at;
            if (body.payment_status !== undefined) update.payment_status = body.payment_status;

            // Shipping
            if (body.shipping_code !== undefined) update.shipping_code = body.shipping_code;

            // Admin notes (frontend sends `admin_note`, DB column is `admin_notes`)
            if (body.admin_note !== undefined) {
                update.admin_notes = body.admin_note;
            }

            // Demo fields
            if (body.demo_version !== undefined) update.demo_version = body.demo_version;
            if (body.revision_feedback !== undefined) update.revision_feedback = body.revision_feedback;

            // When confirming deposit via legacy deposit_paid flag, derive payment_status
            if (body.deposit_paid === true && !body.payment_status) {
                // Determine if it's full payment or deposit
                const { data: currentOrder } = await (this.supabase
                    .from('orders') as any)
                    .select('deposit_amount, total_amount')
                    .eq('id', orderId)
                    .single();

                const total = currentOrder?.total_amount ?? 0;
                const deposit = currentOrder?.deposit_amount ?? 0;

                // If deposit covers total (100% payment) -> paid
                // Otherwise -> deposit_paid
                update.payment_status = deposit >= total ? 'paid' : 'deposit_paid';
            }

            // Auto-complete payment on Delivery/Completion
            if (body.status === 'delivered' || body.status === 'completed') {
                update.payment_status = 'paid';
                if (!update.paid_at) update.paid_at = new Date().toISOString();
                console.log('[AdminOrder] Auto-completing payment for delivery');
            }

            // Determine if we need stock adjustment BEFORE the update
            // We need the current order state to decide
            let shouldDeductStock = false;
            let shouldRestoreStock = false;

            if (body.deposit_paid === true || body.status === 'confirmed') {
                // Fetch current order to check if stock was already deducted
                const { data: currentOrder } = await (this.supabase
                    .from('orders') as any)
                    .select('payment_status, status')
                    .eq('id', orderId)
                    .single();

                // Stock not yet deducted if payment_status is not 'paid' or 'deposit_paid'
                if (currentOrder && currentOrder.payment_status !== 'paid' && currentOrder.payment_status !== 'deposit_paid') {
                    shouldDeductStock = true;
                }
            }

            if (body.status === 'cancelled') {
                // Fetch current order to check if stock was previously deducted
                const { data: currentOrder } = await (this.supabase
                    .from('orders') as any)
                    .select('payment_status, status')
                    .eq('id', orderId)
                    .single();

                // Stock was deducted if payment was confirmed
                const isPaid = currentOrder?.payment_status === 'paid' || currentOrder?.payment_status === 'deposit_paid';
                if (currentOrder && isPaid && currentOrder.status !== 'cancelled') {
                    shouldRestoreStock = true;
                }
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

                // Process stock adjustments after successful update
                if (shouldDeductStock) {
                    try { await this.adjustStockForOrder(orderId, 'deduct'); } catch (e) {
                        console.error('[AdminOrder] Stock deduction failed (non-blocking):', e);
                    }
                }
                if (shouldRestoreStock) {
                    try { await this.adjustStockForOrder(orderId, 'restore'); } catch (e) {
                        console.error('[AdminOrder] Stock restore failed (non-blocking):', e);
                    }
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
     * Adjust stock for all items in an order
     * @param orderId - The order ID
     * @param action - 'deduct' to reduce stock, 'restore' to add back
     */
    /**
     * Adjust stock for all items in an order
     * @param orderId - The order ID
     * @param action - 'deduct' to reduce stock, 'restore' to add back
     */
    private async adjustStockForOrder(orderId: string, action: 'deduct' | 'restore') {
        const multiplier = action === 'deduct' ? -1 : 1;
        console.log(`[StockAdjust] ${action.toUpperCase()} stock for order ${orderId}`);

        // Fetch order items with product_id and configuration
        const { data: items, error: itemsError } = await (this.supabase
            .from('order_items') as any)
            .select('product_id, quantity, configuration, product_name')
            .eq('order_id', orderId);

        if (itemsError || !items || items.length === 0) {
            console.warn(`[StockAdjust] No items found for order ${orderId}:`, itemsError?.message);
            return;
        }

        for (const item of items as any[]) {
            if (!item.product_id) {
                console.log(`[StockAdjust] Skipping item without product_id: ${item.product_name}`);
                continue;
            }

            try {
                // Get size from configuration or top-level if it exists (legacy)
                const itemSize = item.configuration?.size || item.size;

                // Fetch product
                const { data: product, error: productError } = await (this.supabase
                    .from('products') as any)
                    .select('id, name, stock, sizes')
                    .eq('id', item.product_id)
                    .single();

                if (productError || !product) {
                    console.warn(`[StockAdjust] Product ${item.product_id} not found`);
                    continue;
                }

                const qty = item.quantity * multiplier;
                const sizes = product.sizes as any[] | null;

                // Try to find matching size
                if (sizes && sizes.length > 0 && itemSize) {
                    const sizeIndex = sizes.findIndex(
                        (s: any) => s.name === itemSize || s.sku === itemSize
                    );

                    if (sizeIndex >= 0) {
                        // Update size-specific stock
                        const updatedSizes = [...sizes];
                        const currentStock = updatedSizes[sizeIndex].stock || 0;
                        updatedSizes[sizeIndex] = {
                            ...updatedSizes[sizeIndex],
                            stock: Math.max(0, currentStock + qty),
                        };

                        await (this.supabase
                            .from('products') as any)
                            .update({ sizes: updatedSizes, updated_at: new Date().toISOString() })
                            .eq('id', product.id);

                        console.log(`[StockAdjust] ${action} size "${itemSize}" of "${product.name}": ${currentStock} → ${updatedSizes[sizeIndex].stock} (qty: ${item.quantity})`);
                        continue;
                    }
                }

                // Fallback: update product-level stock
                const newStock = Math.max(0, (product.stock || 0) + qty);
                await (this.supabase
                    .from('products') as any)
                    .update({ stock: newStock, updated_at: new Date().toISOString() })
                    .eq('id', product.id);

                console.log(`[StockAdjust] ${action} product "${product.name}" stock: ${product.stock} → ${newStock} (qty: ${item.quantity})`);
            } catch (err) {
                console.error(`[StockAdjust] Error adjusting stock for product ${item.product_id}:`, err);
            }
        }

        console.log(`[StockAdjust] ✓ ${action.toUpperCase()} completed for order ${orderId}`);
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
            if (first.item_type === 'printing' || first.item_type === 'print_3d') return 'printing';

            // Fallback: check configuration/spec object
            const itemConfig = first.configuration || first.spec || {};
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
