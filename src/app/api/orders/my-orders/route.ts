/**
 * User Orders API - Schema v3
 * GET /api/orders/my-orders
 * 
 * Returns all orders for the current user from unified orders table
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

        // Fetch from unified orders table with items
        const { data: orders, error, count } = await supabaseAdmin
            .from('orders')
            .select('*, items:order_items(*)', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[MyOrders] Failed to fetch orders:', error);
            return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
        }

        // Transform to frontend format
        const transformedOrders = (orders || []).map(order => ({
            id: order.id,
            order_code: order.order_code,
            product_name: order.items?.[0]?.name || 'Đơn hàng',
            quantity: order.items?.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0) || 0,
            subtotal: order.subtotal,
            shipping_fee: order.shipping_fee,
            discount: order.discount,
            total: order.total_amount,
            deposit_amount: order.deposit_amount,
            status: order.status,
            payment_status: order.payment_status,
            notes: order.notes,
            shipping_address: order.shipping_address_snapshot,
            created_at: order.created_at,
            updated_at: order.updated_at,
            confirmed_at: order.confirmed_at,
            paid_at: order.paid_at,
            completed_at: order.completed_at,
            items: order.items || [],
        }));

        return NextResponse.json({
            success: true,
            data: transformedOrders,
            meta: {
                total: count || transformedOrders.length,
            }
        });
    } catch (error) {
        console.error('[MyOrders] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
