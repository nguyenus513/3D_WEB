/**
 * User Child Orders API
 * GET /api/orders/my-orders
 * 
 * Returns all order_child records for the current user
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
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;

        // Fetch from order_child table
        const { data: childOrders, error: childError } = await supabaseAdmin
            .from('order_child')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (childError) {
            console.error('[MyOrders] Failed to fetch order_child:', childError);
        }

        // Fetch from legacy orders table
        const { data: legacyOrders, error: legacyError } = await supabaseAdmin
            .from('orders')
            .select('*, order_items(*)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (legacyError) {
            console.error('[MyOrders] Failed to fetch orders:', legacyError);
        }

        // Transform child orders to unified format
        const transformedChildOrders = (childOrders || []).map(order => ({
            id: order.id,
            order_code: order.code_child,
            product_name: order.product_name,
            product_type: order.product_type,
            quantity: order.quantity,
            total: order.total_price,
            status: order.status,
            payment_qr_url: order.payment_qr_url,
            metadata: order.metadata,
            created_at: order.created_at,
            source: 'order_child' as const,
            // For display in order list
            order_items: [{
                name: order.product_name,
                quantity: order.quantity,
                total_price: order.total_price,
            }],
        }));

        // Transform legacy orders
        const transformedLegacyOrders = (legacyOrders || []).map(order => ({
            id: order.id,
            order_code: order.order_code || order.id.substring(0, 12).toUpperCase(),
            product_name: order.order_items?.[0]?.name || 'Đơn hàng',
            product_type: 'product',
            quantity: order.order_items?.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0) || 1,
            total: order.total || order.total_amount,
            status: order.status,
            created_at: order.created_at,
            source: 'orders' as const,
            order_items: order.order_items || [],
        }));

        // Merge and sort by created_at
        const allOrders = [...transformedChildOrders, ...transformedLegacyOrders]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return NextResponse.json({
            success: true,
            data: allOrders,
            meta: {
                total: allOrders.length,
                childOrders: transformedChildOrders.length,
                legacyOrders: transformedLegacyOrders.length,
            }
        });
    } catch (error) {
        console.error('[MyOrders] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
