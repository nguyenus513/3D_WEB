/**
 * User Orders API - Unified Multi-Table Query
 * GET /api/orders/my-orders
 * 
 * Returns all orders for the current user from ALL order tables:
 * - orders (ready-made products)
 * - custom_orders (custom orders)
 * - print_orders (3D printing orders)
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';
import { getProfileId } from '@/lib/utils/getProfileId';

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

interface UnifiedOrder {
    id: string;
    order_code: string;
    order_type: 'ready_made' | 'custom' | 'printing';
    total: number;
    status: string;
    payment_status: string;
    created_at: string;
    order_items?: { name: string; quantity: number; total_price: number }[];
    shipping_address?: Record<string, unknown>;
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Smart profile ID lookup with email fallback
        const userId = await getProfileId(session.user, supabaseAdmin);
        if (!userId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
        }

        const allOrders: UnifiedOrder[] = [];

        // 1. Fetch from product_orders (New Ready-made)
        const { data: productOrders } = await supabaseAdmin
            .from('product_orders')
            .select('*, items:product_order_items(*)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (productOrders) {
            productOrders.forEach(order => {
                allOrders.push({
                    id: order.id,
                    order_code: order.order_code,
                    order_type: 'ready_made',
                    total: order.total_amount || 0,
                    status: order.status,
                    payment_status: order.payment_status || 'pending',
                    created_at: order.created_at,
                    order_items: order.items?.map((item: any) => ({
                        name: item.name,
                        quantity: item.quantity,
                        total_price: item.total_price
                    })) || [],
                    shipping_address: order.shipping_address,
                });
            });
        }

        // 2. Fetch from custom_orders table
        const { data: customOrders } = await supabaseAdmin
            .from('custom_orders')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (customOrders) {
            customOrders.forEach(order => {
                allOrders.push({
                    id: order.id,
                    order_code: order.order_number || order.order_code,
                    order_type: 'custom',
                    total: order.total_amount || 0,
                    status: order.status,
                    payment_status: order.payment_status || 'pending',
                    created_at: order.created_at,
                    order_items: [{
                        name: order.description || 'Đơn hàng Custom',
                        quantity: 1,
                        total_price: order.total_amount || 0,
                    }],
                    shipping_address: order.shipping_address,
                });
            });
        }

        // 3. Fetch from print_orders table
        const { data: printOrders } = await supabaseAdmin
            .from('print_orders')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (printOrders) {
            printOrders.forEach(order => {
                allOrders.push({
                    id: order.id,
                    order_code: order.order_number || order.order_code,
                    order_type: 'printing',
                    total: order.total_amount || 0,
                    status: order.status,
                    payment_status: order.payment_status || 'pending',
                    created_at: order.created_at,
                    order_items: [{
                        name: `In 3D - ${order.print_type || 'FDM'}`,
                        quantity: order.quantity || 1,
                        total_price: order.total_amount || 0,
                    }],
                    shipping_address: order.shipping_address,
                });
            });
        }

        // 4. Fallback: Fetch from legacy 'orders' table (EXCLUDING migrated types)
        const { data: legacyOrders } = await supabaseAdmin
            .from('orders')
            .select(`
                id, order_code, user_id, order_type,
                subtotal, shipping_fee, discount, total_amount, deposit_amount,
                status, payment_status, shipping_address, shipping_address_snapshot,
                created_at, custom_config,
                items:order_items(*)
            `)
            .eq('user_id', userId)
            .neq('order_type', 'custom')
            .neq('order_type', 'printing')
            .order('created_at', { ascending: false });

        if (legacyOrders) {
            legacyOrders.forEach(order => {
                // Determine order type from order_type field or default to ready_made
                const orderType = order.order_type || 'ready_made';

                // Skip if somehow custom/printing still got here (though filtered above)
                if (orderType === 'custom' || orderType === 'printing') return;

                allOrders.push({
                    id: order.id,
                    order_code: order.order_code,
                    order_type: orderType as 'ready_made' | 'custom' | 'printing',
                    total: order.total_amount || 0,
                    status: order.status,
                    payment_status: order.payment_status || 'pending',
                    created_at: order.created_at,
                    order_items: order.items || [],
                    shipping_address: order.shipping_address || order.shipping_address_snapshot,
                });
            });
        }

        // 5. Deduplicate by ID (Priority: product/custom/print > legacy)
        // Since we push strictly from tables, duplicates would only occur if legacy has same ID as new tables
        // (which is true for migrated data).
        // Using a Map to keep the first occurrence (which is from the new tables as they are pushed first)
        const uniqueOrdersMap = new Map<string, UnifiedOrder>();
        allOrders.forEach(order => {
            if (!uniqueOrdersMap.has(order.id)) {
                uniqueOrdersMap.set(order.id, order);
            }
        });

        const uniqueOrders = Array.from(uniqueOrdersMap.values());

        // Sort all orders by created_at (newest first)
        uniqueOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return NextResponse.json({
            success: true,
            data: uniqueOrders,
            meta: {
                total: uniqueOrders.length,
            }
        });
    } catch (error) {
        console.error('[MyOrders] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
