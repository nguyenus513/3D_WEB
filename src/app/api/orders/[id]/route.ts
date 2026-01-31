/**
 * Customer Order Detail API - Schema v3
 * Returns order details for authenticated customer
 * Uses unified orders + order_items tables
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verify session
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const supabase = getAdminSupabase();

        // Smart profile ID lookup with email fallback
        const userId = await getProfileId(session.user, supabase);
        if (!userId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
        }

        // Fetch from unified orders table
        const { data: order, error } = await supabase
            .from('orders')
            .select('*, items:order_items(*)')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error || !order) {
            // Try by order_code if ID didn't match
            const { data: orderByCode, error: codeError } = await supabase
                .from('orders')
                .select('*, items:order_items(*)')
                .eq('order_code', id)
                .eq('user_id', userId)
                .single();

            if (codeError || !orderByCode) {
                return NextResponse.json({ error: 'Order not found' }, { status: 404 });
            }

            return NextResponse.json(transformOrder(orderByCode));
        }

        return NextResponse.json(transformOrder(order));
    } catch (error) {
        console.error('Customer order API error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}

// Transform order to frontend format
function transformOrder(order: Record<string, unknown>) {
    const items = (order.items as Record<string, unknown>[]) || [];

    return {
        id: order.id,
        order_code: order.order_code,
        user_id: order.user_id,
        subtotal: order.subtotal,
        shipping_fee: order.shipping_fee,
        discount: order.discount,
        total: order.total_amount,
        deposit_amount: order.deposit_amount,
        status: order.status,
        payment_status: order.payment_status,
        shipping_address: order.shipping_address_snapshot,
        notes: order.notes,
        admin_notes: order.admin_notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
        confirmed_at: order.confirmed_at,
        paid_at: order.paid_at,
        completed_at: order.completed_at,
        items: items.map((item) => ({
            id: item.id,
            product_id: item.product_id,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            configuration: item.configuration,
        })),
    };
}
