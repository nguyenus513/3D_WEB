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

        // UNIFIED QUERY: Fetch all orders from single table
        const { data: orders, error } = await supabaseAdmin
            .from('orders')
            .select('*, order_items(*)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[MyOrders] DB Error:', error);
            throw error;
        }

        if (orders) {
            orders.forEach(order => {
                const type = order.order_type || 'ready_made';
                const relationalItems = Array.isArray(order.order_items) ? order.order_items : [];
                const jsonItems = Array.isArray(order.items) ? order.items : [];
                let displayItems: any[] = [];

                if (type === 'ready_made') {
                    displayItems = relationalItems.length > 0 ? relationalItems : jsonItems;
                } else if (type === 'custom') {
                    const config = order.custom_config || (order.items_config?.custom) || {};
                    displayItems = [{
                        name: order.notes ? `Custom: ${order.notes}` : 'Đơn hàng Custom',
                        quantity: 1,
                        total_price: order.total_amount || 0,
                        configuration: config
                    }];
                } else if (type === 'printing') {
                    const config = order.printing_config || (order.items_config?.printing) || {};
                    displayItems = [{
                        name: `In 3D - ${config.type || 'FDM'}`,
                        quantity: config.quantity || 1,
                        total_price: order.total_amount || 0,
                        configuration: config
                    }];
                }

                allOrders.push({
                    id: order.id,
                    order_code: order.order_code,
                    order_type: type as any,
                    total: order.total_amount || 0,
                    status: order.status,
                    payment_status: order.payment_status,
                    created_at: order.created_at,
                    order_items: displayItems,
                    shipping_address: order.shipping_address_snapshot as any,
                });
            });
        }

        // No sorting needed as DB query is already sorted


        return NextResponse.json({
            success: true,
            data: allOrders,
            meta: {
                total: allOrders.length,
            }
        });
    } catch (error) {
        console.error('[MyOrders] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
