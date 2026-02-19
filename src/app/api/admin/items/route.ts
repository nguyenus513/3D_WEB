/**
 * Admin Items API Route
 * 
 * GET /api/admin/items - List order items (đơn con) by type
 * Query params:
 *   - type: 'product' | 'custom' | 'printing' | 'all'
 *   - status: filter by production_status
 *   - page, limit: pagination
 * 
 * This API returns SUB-ORDERS (đơn con), NOT cart orders.
 * Each item has cart_order_code format: CARTCODE_ITEMCODE
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
    try {
        // Verify admin session
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse query params
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'all';
        const status = searchParams.get('status');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;

        // Build query - NEW SCHEMA
        let query = supabaseAdmin
            .from('order_items')
            .select(`
                id, name, quantity, unit_price, total_price,
                item_type, production_status,
                item_code, full_code,
                created_at,
                order_id,
                orders!inner (
                    id, order_code, user_id, status, payment_status,
                    created_at,
                    users!user_id (
                        id, name, phone
                    )
                )
            `, { count: 'exact' })
            .order('created_at', { ascending: false });

        // Filter by item type
        if (type !== 'all') {
            const dbType = type === 'printing' ? 'print_3d' : type;
            query = query.eq('item_type', dbType);
        }

        // Filter by production status
        if (status) {
            query = query.eq('production_status', status);
        }

        // Pagination
        query = query.range(offset, offset + limit - 1);

        const { data: items, error, count } = await query;

        if (error) {
            console.error('[AdminItems] Query error:', error);
            return NextResponse.json({
                success: false,
                error: 'Database error',
                details: error.message
            }, { status: 500 });
        }

        // Transform response - format as sub-orders with spec
        const response = (items || []).map(item => {
            const order = item.orders as any;
            const profile = order?.users as any;

            return {
                // Sub-order identifiers
                id: item.id,
                item_code: item.item_code,
                full_code: item.full_code,
                order_code: order?.order_code, // Parent order reference

                // Item details
                name: item.name || 'Sản phẩm',
                quantity: item.quantity || 1,
                unit_price: item.unit_price || 0,
                total_price: item.total_price || 0,
                item_type: item.item_type || 'product',

                // Production info
                production_status: item.production_status || 'waiting',

                // Timestamps
                created_at: item.created_at,

                // Parent order info
                order: {
                    id: order?.id,
                    order_code: order?.order_code,
                    status: order?.status,
                    payment_status: order?.payment_status,
                    created_at: order?.created_at,
                },

                // Customer info
                customer: profile ? {
                    id: profile.id,
                    name: profile.name,
                    phone: profile.phone,
                } : null,
            };
        });

        return NextResponse.json({
            success: true,
            data: response,
            meta: {
                total: count || 0,
                page,
                limit,
                totalPages: Math.ceil((count || 0) / limit),
                type,
            }
        });

    } catch (error) {
        console.error('[AdminItems] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
