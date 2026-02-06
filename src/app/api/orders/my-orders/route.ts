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

        // 1. Fetch from orders table (ready-made products AND custom orders)
        const { data: readyMadeOrders } = await supabaseAdmin
            .from('orders')
            .select('*, items:order_items(*)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (readyMadeOrders) {
            readyMadeOrders.forEach(order => {
                // Determine order type from order_type field or default to ready_made
                const orderType = order.order_type || 'ready_made';

                // Generate order_items based on order type
                let orderItems = order.items || [];
                if (orderType === 'custom' && (!orderItems || orderItems.length === 0)) {
                    // For custom orders, generate items from custom_config
                    const config = order.custom_config || {};
                    const typeLabel = config.type === 'single' ? 'Cá nhân (1 người)' :
                        config.type === 'couple' ? 'Cặp đôi (2 người)' :
                            config.type === 'group' ? 'Nhóm (3+ người)' : 'Custom';
                    const sizeLabel = config.size ? `Size ${config.size}` : '';
                    orderItems = [{
                        name: `Đơn Custom - ${typeLabel}${sizeLabel ? ' - ' + sizeLabel : ''}`,
                        quantity: 1,
                        total_price: order.total_amount || 0,
                    }];
                }

                allOrders.push({
                    id: order.id,
                    order_code: order.order_code,
                    order_type: orderType as 'ready_made' | 'custom' | 'printing',
                    total: order.total_amount || 0,
                    status: order.status,
                    payment_status: order.payment_status || 'pending',
                    created_at: order.created_at,
                    order_items: orderItems,
                    shipping_address: order.shipping_address || order.shipping_address_snapshot,
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
                    order_code: order.order_number || order.order_code || order.id.slice(0, 8),
                    order_type: 'custom',
                    total: order.total || order.estimated_price || 0,
                    status: order.status,
                    payment_status: order.status === 'pending' ? 'pending' : 'paid',
                    created_at: order.created_at,
                    order_items: [{
                        name: order.description || 'Đơn hàng Custom',
                        quantity: order.quantity || 1,
                        total_price: order.total || order.estimated_price || 0,
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
                    order_code: order.order_number || order.id.slice(0, 8),
                    order_type: 'printing',
                    total: order.total_price || 0,
                    status: order.status,
                    payment_status: order.status === 'pending' ? 'pending' : 'paid',
                    created_at: order.created_at,
                    order_items: [{
                        name: `In 3D - ${order.print_type || 'FDM'}`,
                        quantity: order.quantity || 1,
                        total_price: order.total_price || 0,
                    }],
                });
            });
        }

        // 4. Fetch from master_orders (New DB Schema Support)
        const { data: masterOrders } = await supabaseAdmin
            .from('master_orders')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (masterOrders) {
            masterOrders.forEach(order => {
                // Determine if this master order likely replicates children we already have.
                // Since we don't have easy dedup logic here without complex joins, 
                // we will include it but marked clearly if possible.
                // For now, we allow duplication to ensure visibility if children are missing.
                allOrders.push({
                    id: order.id,
                    order_code: order.order_number || order.id.slice(0, 8),
                    order_type: 'ready_made', // Defaulting to ready_made for generic display or use a new type if frontend supports it
                    total: order.total || 0,
                    status: order.status,
                    payment_status: order.payment_status || 'pending',
                    created_at: order.created_at,
                    order_items: [{
                        name: 'Đơn hàng tổng hợp (Master)',
                        quantity: 1,
                        total_price: order.total || 0,
                    }],
                });
            });
        }

        // Sort all orders by created_at (newest first)
        allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
