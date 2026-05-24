/**
 * Admin Order Controller
 *
 * Request handling layer for admin order management APIs.
 * Updated for Schema V6 (Unified Orders - single `orders` table).
 */

import { NextRequest } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { BaseController, UnauthorizedError, NotFoundError } from '@/lib/core/BaseController';
import { requireAdmin } from '@/lib/security/admin-guard';
import { resolveOrderDate } from '@/lib/utils/orderDate';

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


function is3dModelFile(file: { file_name?: string; file_key?: string; file_type?: string }): boolean {
    const value = `${file.file_name || ''} ${file.file_key || ''} ${file.file_type || ''}`.toLowerCase();
    return /\.(stl|obj|3mf|step|stp)(\?|$|\s)/.test(value)
        || value.includes('model/stl')
        || value.includes('model/obj')
        || value.includes('model/3mf')
        || value.includes('model/step')
        || value.includes('application/sla')
        || value.includes('application/step')
        || value.includes('application/octet-stream');
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

    private _supabase: ReturnType<typeof getAdminSupabase> | null = null;

    /**
     * Lazy initialize Supabase Admin Client
     * Prevents startup crashes if env vars are missing during build/init
     */
    private get supabase() {
        if (!this._supabase) {
            this._supabase = getAdminSupabase();
        }
        return this._supabase;
    }


    private async getProfilesByIds(userIds: string[]): Promise<Map<string, any>> {
        const ids = [...new Set(userIds.filter(Boolean))];
        if (ids.length === 0) return new Map();

        const { data } = await this.supabase
            .from('users')
            .select('*')
            .in('id', ids) as any;

        return new Map((data || []).map((profile: any) => [profile.id, profile]));
    }

    private resolveProfile(order: any, profileMap?: Map<string, any>) {
        const profile = order.user || profileMap?.get(order.user_id) || null;
        const shipping = order.shipping_address || order.shipping_address_snapshot || {};
        if (!profile && !shipping?.full_name && !shipping?.phone) return null;

        return {
            ...(profile || {}),
            id: profile?.id || order.user_id || null,
            full_name: profile?.profile?.full_name || profile?.full_name || profile?.name || shipping?.full_name || null,
            name: profile?.name || profile?.full_name || shipping?.full_name || null,
            email: profile?.email || null,
            phone: profile?.profile?.phone || profile?.phone || shipping?.phone || null,
            customer_code: profile?.customer_code || null,
        };
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
            const type = searchParams.get('type') || searchParams.get('order_type');
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

            if (type && type !== 'all') {
                if (type === 'ready_made' || type === 'product' || type === 'products') {
                    query = query.in('order_type', ['ready_made', 'product']);
                } else if (type === 'printing' || type === 'print_3d') {
                    query = query.in('order_type', ['printing', 'print_3d']);
                } else {
                    query = query.eq('order_type', type);
                }
            }

            const { data: orders, error, count } = await query;

            if (error) {
                console.error('[AdminOrder] listOrders error:', error.message);
                throw new Error(`Failed to list orders: ${error.message}`);
            }

            const profileMap = await this.getProfilesByIds((orders || []).map((order: any) => order.user_id));

            // Transform to expected frontend format
            const transformedOrders = (orders || [])
                .map((o: any) => ({
                ...o,
                created_at: resolveOrderDate(o, Array.isArray(o.items) ? o.items : []),
                profiles: this.resolveProfile(o, profileMap),
                total: o.total_amount,
                order_items: o.items,
                order_type: o.order_type || this.inferOrderType(o.items),
                _source_table: 'orders'
                }))
                .filter((order: any) => this.matchesOrderType(order, type))
                .sort((a: any, b: any) => (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0));

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

            const fileIds = [...new Set((fileLinks || []).map((link: any) => link.file_id).filter(Boolean))];
            let filesById = new Map<string, any>();
            if (fileIds.length > 0) {
                const { data: linkedFiles } = await this.supabase
                    .from('files')
                    .select('*')
                    .in('id', fileIds) as any;
                filesById = new Map((linkedFiles || []).map((file: any) => [file.id, file]));
            }

            // Map to frontend structure
            const toAmount = (value: unknown): number => {
                const amount = Number(value ?? 0);
                return Number.isFinite(amount) ? amount : 0;
            };
            const items = Array.isArray(order.items) ? order.items.map((item: any) => {
                const quantity = Math.max(1, Number(item.quantity || 1));
                const unitPrice = toAmount(item.unit_price);
                const totalPrice = toAmount(item.total_price) || unitPrice * quantity;
                return { ...item, quantity, unit_price: unitPrice, total_price: totalPrice };
            }) : [];
            const mainItem = items[0] || {};
            const itemConfig = mainItem.configuration || {};
            const rawOrderType = order.order_type || this.inferOrderType(items);
            // Normalize order type: treat 'print_3d' as 'printing' for frontend
            const orderType = rawOrderType === 'print_3d' ? 'printing' : rawOrderType;

            // Map file_links for admin consumption
            // files table columns: id, file_url, mime_type, size_bytes, provider, created_at
            const orderFiles = Array.isArray(fileLinks) ? fileLinks.map((fl: any) => {
                const f = fl.file || filesById.get(fl.file_id) || {};
                // Extract a display name from file_url (last segment or drive ID)
                const fileUrl = f.file_url || '';
                const displayName = fileUrl.split('/').pop() || fileUrl || 'unknown';
                const meta = fl.metadata || {};
                return {
                    id: fl.id,
                    file_id: fl.file_id,
                    // Map order_item ref to order_item_id for frontend matching
                    order_item_id: fl.ref_type === 'order_item' ? fl.ref_id : null,
                    file_name: meta.original_name || displayName,
                    file_key: f.file_url,       // file_url serves as the key/path
                    file_type: f.mime_type,
                    file_url: resolveFileUrl(f.file_url, f.provider),
                    tag: fl.tag,
                    ref_type: fl.ref_type,
                    storage_provider: f.provider,
                    size_bytes: f.size_bytes,
                    created_at: fl.created_at,
                    // Enriched metadata
                    category: fl.tag || 'main',
                    character_index: meta.character_index || 1,
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
                        thumbnail: f.file_url,
                        category: f.category || 'main',
                        characterIndex: f.character_index || 1,
                    }));

                custom_config = {
                    type: itemConfig.type || (mainItem.configuration as any)?.type || 'unknown',
                    size: itemConfig.size || (mainItem.configuration as any)?.size || 'Chưa chọn',
                    notes: order.notes || (mainItem.configuration as any)?.notes || '',
                    images,
                    characters: Array.isArray(itemConfig.characters) ? itemConfig.characters : [],
                };
            }

            // Printing config: per-item print specs
            let printing_config = null;
            if (orderType === 'printing' || rawOrderType === 'print_3d') {
                const totalQuantity = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
                const printJobs = items
                    .map((item: any) => Array.isArray(item.print_job) ? item.print_job[0] : item.print_job)
                    .filter(Boolean);
                const firstJob = printJobs[0] || {};
                const firstPrintOptions = items.find((item: any) => item?.configuration?.printOptions)?.configuration?.printOptions || {};
                const linkedModelFiles = orderFiles
                    .filter((file: any) => is3dModelFile(file))
                    .map((file: any) => ({
                        id: file.id,
                        key: file.file_key,
                        name: file.file_name || String(file.file_key || '').split('/').pop() || 'file-3d',
                        url: file.file_url,
                        type: file.file_type,
                        size: file.size_bytes || 0,
                        created_at: file.created_at,
                    }));
                const fallbackModelFiles = linkedModelFiles.length > 0 ? [] : items
                    .filter((item: any) => is3dModelFile({ file_name: item.name, file_type: item.configuration?.fileType }))
                    .map((item: any) => ({
                        id: item.id,
                        key: item.full_code || item.item_code || item.id,
                        name: item.name || 'file-3d',
                        url: '',
                        type: item.configuration?.fileType || 'model/stl',
                        size: item.configuration?.fileSize || 0,
                        created_at: item.created_at,
                        missingLink: true,
                    }));
                const modelFiles = linkedModelFiles.length > 0 ? linkedModelFiles : fallbackModelFiles;
                const estimatedGrams = printJobs.reduce((sum: number, job: any) => sum + toAmount(job.estimated_grams), 0);
                const estimatedHours = printJobs.reduce((sum: number, job: any) => sum + toAmount(job.estimated_hours), 0);
                const itemTotal = items.reduce((sum: number, item: any) => sum + toAmount(item.total_price), 0);
                printing_config = {
                    type: firstPrintOptions.type || (firstJob.material === 'standard_resin' ? 'resin' : 'fdm'),
                    color: firstJob.color || firstPrintOptions.color || '',
                    infill: firstJob.infill ?? firstPrintOptions.infill ?? null,
                    layerHeight: firstJob.layer_height ?? firstPrintOptions.layerHeight ?? null,
                    quantity: totalQuantity,
                    files: modelFiles,
                    analysis: printJobs.length > 0 ? {
                        grams: estimatedGrams,
                        hours: estimatedHours,
                        price: itemTotal,
                    } : null,
                    notes: order.notes || '',
                };
            }

            // Build profile with full_name resolution
            const profileMap = await this.getProfilesByIds([order.user_id]);
            const resolvedProfile = this.resolveProfile(order, profileMap);

            return this.handleSuccess({
                order: {
                    ...order,
                    created_at: resolveOrderDate(order, items),
                    profiles: resolvedProfile,
                    order_items: items,
                    order_files: orderFiles,
                    total: toAmount(order.total_amount) || toAmount(order.total) || toAmount(order.subtotal),
                    subtotal: toAmount(order.subtotal) || toAmount(order.total_amount) || toAmount(order.total),
                    shipping_fee: toAmount(order.shipping_fee),
                    deposit_amount: toAmount(order.deposit_amount),
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

            // Build update object from whitelist only
            const update: Record<string, unknown> = {};

            // Status
            if (body.status !== undefined && body.status !== null) {
                update.status = body.status;
            }

            update.updated_at = new Date().toISOString();

            // Payment fields (deposit_paid column removed — derive payment_status instead)
            if (body.paid_at !== undefined) update.paid_at = body.paid_at;
            if (body.payment_status !== undefined) update.payment_status = body.payment_status;

            // Shipping
            if (body.shipping_code !== undefined) update.shipping_code = body.shipping_code;

            // Status timestamps used by admin/user timelines
            for (const field of [
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
                'completed_at',
            ]) {
                if (body[field] !== undefined) update[field] = body[field];
            }

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
                    order: data,
                    updatedFields: Object.keys(attemptUpdate),
                });
            }

            // If we exhausted retries, try status-only update as last resort
            if (update.status) {
                
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
     * Adjust stock for all items in an order using atomic RPCs
     * @param orderId - The order ID
     * @param action - 'deduct' (confirm_variant_stock) or 'restore' (release_variant_stock)
     */
    private async adjustStockForOrder(orderId: string, action: 'deduct' | 'restore') {
        

        // Fetch order items with product_id and configuration
        const { data: items, error: itemsError } = await (this.supabase
            .from('order_items') as any)
            .select('product_id, quantity, configuration, name')
            .eq('order_id', orderId);

        if (itemsError || !items || items.length === 0) {
            console.warn(`[StockAdjust] No items found for order ${orderId}:`, itemsError?.message);
            return;
        }

        for (const item of items as any[]) {
            if (!item.product_id) {
                
                continue;
            }

            try {
                const itemSize = item.configuration?.size || item.size;
                const qty = item.quantity || 1;

                // Try to find matching variant in product_variants table
                if (itemSize) {
                    const { data: variant } = await (this.supabase
                        .from('product_variants') as any)
                        .select('id, name, sku, stock, reserved_stock')
                        .eq('product_id', item.product_id)
                        .or(`name.eq.${itemSize},sku.eq.${itemSize}`)
                        .maybeSingle();

                    if (variant) {
                        // Use atomic RPCs with FOR UPDATE locking
                        const rpcName = action === 'deduct'
                            ? 'confirm_variant_stock'
                            : 'release_variant_stock';

                        const { error: rpcError } = await (this.supabase.rpc as any)(rpcName, {
                            p_variant_id: variant.id,
                            p_qty: qty,
                        });

                        if (rpcError) {
                            console.error(`[StockAdjust] RPC ${rpcName} failed for variant ${variant.id}:`, rpcError.message);
                        }
                        continue;
                    }
                }

                // Fallback: update product-level stock directly (no variant match)
                const { data: product } = await (this.supabase
                    .from('products') as any)
                    .select('id, name, stock')
                    .eq('id', item.product_id)
                    .single();

                if (product) {
                    const multiplier = action === 'deduct' ? -1 : 1;
                    const newStock = Math.max(0, (product.stock || 0) + (qty * multiplier));
                    await (this.supabase
                        .from('products') as any)
                        .update({ stock: newStock, updated_at: new Date().toISOString() })
                        .eq('id', product.id);

                    
                }
            } catch (err) {
                console.error(`[StockAdjust] Error adjusting stock for product ${item.product_id}:`, err);
            }
        }

        
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

    private matchesOrderType(order: any, requestedType: string | null): boolean {
        if (!requestedType || requestedType === 'all') return true;
        const actualType = order.order_type || this.inferOrderType(order.items || order.order_items || []);
        if (requestedType === 'ready_made' || requestedType === 'product' || requestedType === 'products') {
            return actualType === 'ready_made' || actualType === 'product';
        }
        if (requestedType === 'printing' || requestedType === 'print_3d') {
            return actualType === 'printing' || actualType === 'print_3d';
        }
        return actualType === requestedType;
    }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const adminOrderController = new AdminOrderController();



