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
     * List all orders from ALL tables (orders, custom_orders, print_orders)
     * Note: Pagination is approximate due to multi-table merge.
     */
    async listOrders(request: NextRequest) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            const { searchParams } = new URL(request.url);
            const status = searchParams.get('status');
            const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
            const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
            // Fetch more than limit from each table to ensure we have enough after merge/sort
            const fetchLimit = limit * page;

            // 1. Fetch from ready-made orders
            let queryOrders = this.supabase
                .from('orders')
                .select('*, user:profiles(id, full_name, email, phone, customer_code), items:order_items(*)')
                .order('created_at', { ascending: false })
                .range(0, fetchLimit);

            // 2. Fetch from custom_orders
            let queryCustom = this.supabase
                .from('custom_orders')
                .select('*') // user info needs to be fetched separately or joined if possible. custom_orders has user_id
                .order('created_at', { ascending: false })
                .range(0, fetchLimit);

            // 3. Fetch from print_orders
            let queryPrint = this.supabase
                .from('print_orders')
                .select('*')
                .order('created_at', { ascending: false })
                .range(0, fetchLimit);


            // 4. Fetch from master_orders
            let queryMaster = this.supabase
                .from('master_orders')
                .select('*')
                .order('created_at', { ascending: false })
                .range(0, fetchLimit);

            if (status && status !== 'all') {
                queryOrders = queryOrders.eq('status', status);
                queryCustom = queryCustom.eq('status', status);
                queryPrint = queryPrint.eq('status', status);
                queryMaster = queryMaster.eq('status', status);
            }

            const [resOrders, resCustom, resPrint, resMaster] = await Promise.all([
                queryOrders,
                queryCustom,
                queryPrint,
                queryMaster
            ]);

            // Handle errors
            if (resOrders.error) console.error('Error fetching orders:', resOrders.error);
            if (resCustom.error) console.error('Error fetching custom_orders:', resCustom.error);
            if (resPrint.error) console.error('Error fetching print_orders:', resPrint.error);
            if (resMaster.error) console.error('Error fetching master_orders:', resMaster.error);

            // Access to profiles for custom/print orders might be needed. 
            // For now, we'll try to get user data if we can, or just display what we have.
            // A better way is to do a second pass to fetch profiles for user_ids found.

            const orders = (resOrders.data || []) as any[];
            const customOrders = (resCustom.data || []) as any[];
            const printOrders = (resPrint.data || []) as any[];
            const masterOrders = (resMaster.data || []) as any[];

            // Gather all user IDs from custom and print orders to fetch profiles efficiently
            const userIds = new Set([
                ...(customOrders as any[]).map(o => o.user_id),
                ...(printOrders as any[]).map(o => o.user_id),
                ...(masterOrders as any[]).map(o => o.user_id)
            ].filter(Boolean));

            let profilesMap: Record<string, any> = {};
            if (userIds.size > 0) {
                const { data: profiles } = await this.supabase
                    .from('profiles')
                    .select('id, full_name, email, phone, customer_code')
                    .in('id', Array.from(userIds));

                if (profiles) {
                    (profiles as any[]).forEach(p => profilesMap[p.id] = p);
                }
            }

            // Transform and Merge
            const allOrders = [
                ...orders.map(o => ({
                    ...o,
                    profiles: o.user,
                    total: o.total_amount,
                    order_items: o.items,
                    order_type: this.inferOrderType(o.items),
                    _source_table: 'orders'
                })),
                ...customOrders.map(o => ({
                    id: o.id,
                    order_code: o.order_number || o.order_code, // Use order_number as primary code
                    status: o.status,
                    payment_status: o.status === 'pending' ? 'pending' : 'paid', // simplistic mapping
                    total: o.total || o.estimated_price || 0,
                    total_amount: o.total || o.estimated_price || 0, // Fix for NaN display
                    notes: o.customer_note || o.notes || '', // Map to 'notes' for frontend
                    admin_notes: o.admin_note || o.admin_notes || '', // Map to 'admin_notes' for frontend
                    created_at: o.created_at,
                    profiles: profilesMap[o.user_id] || { email: 'Unknown' },
                    user_id: o.user_id,
                    order_type: 'custom',
                    // Ad-hoc item for frontend display
                    order_items: [{
                        name: 'Custom Order',
                        quantity: o.quantity || 1,
                        total_price: o.total || o.estimated_price || 0,
                        unit_price: (o.total || o.estimated_price || 0) / (o.quantity || 1)
                    }],
                    _source_table: 'custom_orders'
                })),
                ...printOrders.map(o => ({
                    id: o.id,
                    order_code: o.order_number,
                    status: o.status,
                    payment_status: o.status === 'pending' ? 'pending' : 'paid',
                    total: o.total_price || 0,
                    total_amount: o.total_price || 0, // Fix for NaN display
                    notes: o.customer_note || o.note || '', // Map to 'notes' for frontend
                    admin_notes: o.admin_note || '', // Map to 'admin_notes' for frontend
                    created_at: o.created_at,
                    profiles: profilesMap[o.user_id] || { email: 'Unknown' },
                    user_id: o.user_id,
                    order_type: 'printing',
                    order_items: [{
                        name: `3D Print (${o.print_type})`,
                        quantity: o.quantity || 1,
                        total_price: o.total_price || 0,
                        unit_price: (o.total_price || 0) / (o.quantity || 1)
                    }],
                    _source_table: 'print_orders'
                })),
                ...masterOrders.map(o => ({
                    id: o.id,
                    order_code: o.order_number || o.id.slice(0, 8),
                    status: o.status,
                    payment_status: o.payment_status || 'pending',
                    total: o.total || 0,
                    total_amount: o.total || 0,
                    notes: o.note || '',
                    admin_notes: '',
                    created_at: o.created_at,
                    profiles: profilesMap[o.user_id] || { email: 'Unknown' },
                    user_id: o.user_id,
                    order_type: 'ready_made', // Default type
                    order_items: [{
                        name: 'Master Order',
                        quantity: 1,
                        total_price: o.total || 0,
                        unit_price: o.total || 0
                    }],
                    _source_table: 'master_orders'
                }))
            ];

            // Sort by created_at DESC
            allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // Slice page
            const start = (page - 1) * limit;
            const end = start + limit;
            const pagedOrders = allOrders.slice(start, end);

            return this.handleSuccess({
                orders: pagedOrders,
                total: allOrders.length, // Total of what we fetched, roughly
                page,
                limit
            });
        }, 'AdminOrderController.listOrders');
    }

    /**
     * GET /api/admin/orders/[id]
     * Get single order by ID from ANY table
     */
    async getOrder(request: NextRequest, orderId: string) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            // 1. Try custom_orders table (Primary for Custom items)
            const { data: customOrder } = await this.supabase
                .from('custom_orders')
                .select('*')
                .eq('id', orderId)
                .maybeSingle() as { data: any, error: any };

            if (customOrder) {
                // Fetch profile
                const { data: profile } = await this.supabase.from('profiles').select('*').eq('id', customOrder.user_id).single();

                // === Get fresh status and demo_image_url - ALWAYS try multiple methods ===
                let finalStatus = customOrder.status;
                let finalDemoUrl = customOrder.demo_image_url;

                console.log('[AdminOrder] Status from Supabase:', { status: finalStatus });

                // Virtual Status fallback: If demo_image_url exists but status is stuck, FORCE to 'review'
                if (finalDemoUrl && ['pending', 'confirmed', 'designing'].includes(finalStatus)) {
                    console.log('[AdminOrder] Virtual Status override: forcing to review');
                    finalStatus = 'review';
                }

                // Ensure custom_config.images exists (map from photos if needed)
                let customConfig = customOrder.custom_config || {};

                // Map 'photos' to 'images' if 'images' is missing/empty but 'photos' exists
                if ((!customConfig.images || customConfig.images.length === 0) && customConfig.photos && Array.isArray(customConfig.photos)) {
                    customConfig.images = customConfig.photos.map((p: any) => ({
                        id: p.drive_file_id || p.id,
                        name: p.file_name || p.name,
                        url: p.web_view_link || p.url,
                        thumbnail: p.thumbnail
                    }));
                }

                // === MERGE FINANCE DATA FROM ORDERS TABLE ===
                // Fetch from orders (Primary for FINANCE & ADMIN NOTES)
                const { data: masterOrder } = await this.supabase
                    .from('orders')
                    .select('deposit_paid, deposit_amount, paid_at, shipping_code, admin_notes, notes, shipping_address_snapshot')
                    .eq('id', orderId)
                    .maybeSingle() as any;

                const financialData = masterOrder ? {
                    deposit_paid: masterOrder.deposit_paid,
                    deposit_amount: masterOrder.deposit_amount,
                    paid_at: masterOrder.paid_at,
                    shipping_code: masterOrder.shipping_code,
                    admin_note: masterOrder.admin_notes,
                    customer_note: masterOrder.notes,
                    shipping_address: masterOrder.shipping_address_snapshot || customOrder.shipping_address
                } : {
                    deposit_paid: customOrder.status !== 'pending',
                    deposit_amount: customOrder.deposit_amount || 0,
                    paid_at: null,
                    shipping_code: null,
                    admin_note: customOrder.admin_note,
                    customer_note: customOrder.customer_note,
                    shipping_address: customOrder.shipping_address
                };

                return this.handleSuccess({
                    order: {
                        ...customOrder,
                        ...financialData,
                        status: finalStatus,
                        demo_image_url: finalDemoUrl,
                        profiles: profile,
                        total: customOrder.total || customOrder.estimated_price,
                        total_amount: customOrder.total || customOrder.estimated_price || 0,
                        customer_note: customOrder.customer_note,
                        admin_note: customOrder.admin_note,
                        order_type: 'custom',
                        order_items: [{
                            name: 'Custom Order',
                            quantity: customOrder.quantity || 1,
                            total_price: customOrder.total || customOrder.estimated_price || 0,
                            unit_price: (customOrder.total || customOrder.estimated_price || 0) / (customOrder.quantity || 1)
                        }],
                        custom_config: customConfig,
                        shipping_address: customOrder.shipping_address,
                        _source_table: 'custom_orders'
                    },
                    profile: profile
                });
            }

            // 2. Try print_orders table
            const { data: printOrder } = await this.supabase
                .from('print_orders')
                .select('*')
                .eq('id', orderId)
                .maybeSingle() as { data: any, error: any };

            if (printOrder) {
                const { data: profile } = await this.supabase.from('profiles').select('*').eq('id', printOrder.user_id).single();

                // Virtual Status: If demo_image_url exists but status is stuck, override to 'review'
                let finalStatus = printOrder.status;
                const finalDemoUrl = printOrder.demo_image_url;

                if (finalDemoUrl && ['pending', 'confirmed', 'designing'].includes(finalStatus)) {
                    finalStatus = 'review';
                }

                return this.handleSuccess({
                    order: {
                        ...printOrder,
                        status: finalStatus, // Apply virtual status
                        demo_image_url: finalDemoUrl, // Apply virtual demo url
                        profiles: profile,
                        total: printOrder.total_price,
                        total_amount: printOrder.total_price || 0, // Normalize
                        customer_note: printOrder.customer_note,
                        admin_note: printOrder.admin_note,
                        order_type: 'printing',
                        order_items: [{
                            name: `In 3D - ${printOrder.print_tech}`,
                            quantity: printOrder.quantity || 1,
                            total_price: printOrder.total_price || 0,
                            unit_price: (printOrder.total_price || 0) / (printOrder.quantity || 1)
                        }],
                        printing_config: {
                            type: printOrder.print_tech,
                            color: printOrder.color,
                            file_url: printOrder.file_url
                        },
                        shipping_address: printOrder.shipping_address,
                        _source_table: 'print_orders'
                    },
                    profile: profile
                });
            }

            // 3. Try orders table (Fallback for Ready Made or Legacy)
            const { data: order, error } = await this.supabase
                .from('orders')
                .select(`*, user:profiles(*), items:order_items(*), address:addresses(*)`)
                .eq('id', orderId)
                .maybeSingle() as any;

            if (order) {
                // Map to legacy structure
                const items = Array.isArray(order.items) ? order.items : [];
                const mainItem = items[0] || {};
                const config = mainItem.configuration || {};
                const orderType = this.inferOrderType(items);

                let custom_config = null;
                if (orderType === 'custom') {
                    custom_config = {
                        type: config.type || 'unknown',
                        size: config.size || mainItem?.size || 'Chưa chọn',
                        notes: order.notes || '',
                        images: (Array.isArray(config.photos) ? config.photos : []).map((p: any) => ({
                            id: p.drive_file_id || p.id,
                            name: p.file_name || p.name,
                            url: p.web_view_link || p.url,
                            thumbnail: p.thumbnail
                        })),
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
                        shipping_address: order.shipping_address_snapshot,
                        _source_table: 'orders'
                    },
                    profile: order.user,
                });
            }

            throw new NotFoundError('Order not found in any table');

        }, 'AdminOrderController.getOrder');
    }

    /**
     * PUT /api/admin/orders/[id]
     * Update order with status timestamps - Multi-table support
     */
    async updateOrder(request: NextRequest, orderId: string) {
        return this.wrapHandler(async () => {
            const { authorized } = await requireAdmin(request);
            if (!authorized) throw new UnauthorizedError('Admin access required');

            const body = await request.json();
            console.log('[AdminOrder] Update request:', { orderId, body });

            // CRITICAL: Start with ONLY columns that definitely exist in ALL tables
            // custom_orders only has: id, user_id, status, updated_at, demo_image_url, etc.
            // It does NOT have: admin_note, shipping_code, confirmed_at, etc.

            // Try each table with table-specific update objects
            const tables = ['custom_orders', 'print_orders', 'orders', 'master_orders'];

            for (const table of tables) {
                try {
                    // Build minimal update - ONLY status and updated_at
                    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

                    // Only add status if provided
                    if (body.status !== undefined && body.status !== null) {
                        update.status = body.status;
                    }

                    // Auto-complete payment on Delivery/Completion (50/50 Model)
                    if (body.status === 'delivered' || body.status === 'completed') {
                        update.payment_status = 'paid';
                        // Only update paid_at if not already set (preserve original deposit date if needed, though for full payment this usually implies "now")
                        // Actually for 50/50, paid_at usually marks the FINAL payment.
                        // Let's set it to now if we are moving to paid.
                        update.paid_at = new Date().toISOString();
                        console.log('[AdminOrder] Auto-completing payment for delivery');
                    }

                    // For 'orders' table, we can add admin_notes (note the plural)
                    // But skip for custom_orders/print_orders to avoid errors

                    console.log(`[AdminOrder] Trying ${table} with update:`, update);

                    const { data, error } = await (this.supabase
                        .from(table) as any)
                        .update(update)
                        .eq('id', orderId)
                        .select('id');

                    if (error) {
                        console.log(`[AdminOrder] ${table} error:`, error.message);
                        continue;
                    }

                    if (data && data.length > 0) {
                        console.log(`[AdminOrder] ✓ Updated ${table}:`, data.length, 'rows');
                        return this.handleSuccess({ success: true, table, updatedFields: Object.keys(update) });
                    }

                    console.log(`[AdminOrder] ${table} - no rows matched`);
                } catch (err) {
                    console.log(`[AdminOrder] ${table} exception:`, (err as Error).message);
                }
            }

            throw new NotFoundError('Order not found in any table');
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
