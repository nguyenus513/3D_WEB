/**
 * Single Order Lookup API
 * GET /api/orders/lookup?id=xxx
 * 
 * Searches across all order tables to find a specific order
 * Used by checkout success page to display QR
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';
import { getProfileId } from '@/lib/utils/getProfileId';
import { getBankConfig } from '@/lib/vietqr';

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

        const userId = await getProfileId(session.user, supabaseAdmin);
        if (!userId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get('id');

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
        }

        console.log('[OrderLookup] Searching for order:', orderId, 'user:', userId);

        // Search across all order tables
        let order = null;
        let orderType: 'ready_made' | 'custom' | 'printing' = 'ready_made';

        // 1. Try custom_orders by order_number (most common field)
        const { data: customByNumber } = await supabaseAdmin
            .from('custom_orders')
            .select('*')
            .eq('user_id', userId)
            .eq('order_number', orderId)
            .maybeSingle();

        if (customByNumber) {
            order = customByNumber;
            orderType = 'custom';
            console.log('[OrderLookup] Found in custom_orders by order_number');
        }

        // 1b. Try custom_orders by order_code
        if (!order) {
            const { data: customByCode } = await supabaseAdmin
                .from('custom_orders')
                .select('*')
                .eq('user_id', userId)
                .eq('order_code', orderId)
                .maybeSingle();

            if (customByCode) {
                order = customByCode;
                orderType = 'custom';
                console.log('[OrderLookup] Found in custom_orders by order_code');
            }
        }

        // 2. Try print_orders
        if (!order) {
            const { data: printOrder } = await supabaseAdmin
                .from('print_orders')
                .select('*')
                .eq('user_id', userId)
                .eq('order_number', orderId)
                .maybeSingle();

            if (printOrder) {
                order = printOrder;
                orderType = 'printing';
                console.log('[OrderLookup] Found in print_orders');
            }
        }

        // 3. Try orders table
        if (!order) {
            const { data: readyMadeOrder } = await supabaseAdmin
                .from('orders')
                .select('*')
                .eq('user_id', userId)
                .eq('order_code', orderId)
                .maybeSingle();

            if (readyMadeOrder) {
                order = readyMadeOrder;
                orderType = 'ready_made';
                console.log('[OrderLookup] Found in orders');
            }
        }

        // 4. Try master_orders
        if (!order) {
            const { data: masterOrder } = await supabaseAdmin
                .from('master_orders')
                .select('*, address:addresses(*)')
                .eq('user_id', userId)
                .eq('order_number', orderId)
                .maybeSingle();

            if (masterOrder) {
                order = masterOrder;
                orderType = 'ready_made';
                console.log('[OrderLookup] Found in master_orders');
            }
        }

        if (!order) {
            console.log('[OrderLookup] Order not found in any table');
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Generate QR info
        const total = order.total || order.total_amount || order.total_price || order.estimated_price || 0;
        const depositAmount = order.deposit_amount || Math.round(total * 0.5);
        const bankConfig = getBankConfig(orderType);
        const transferContent = `MINWSUN_${order.order_number || order.order_code || orderId}`;
        const qrUrl = `https://img.vietqr.io/image/${bankConfig.bankId}-${bankConfig.accountNo}-compact2.png?amount=${depositAmount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bankConfig.accountName)}`;

        return NextResponse.json({
            success: true,
            data: {
                id: order.id,
                order_code: order.order_number || order.order_code,
                order_type: orderType,
                total,
                deposit_amount: depositAmount,
                status: order.status,
                payment_status: order.payment_status || 'pending',
                shipping_address: order.shipping_address || order.address,
                created_at: order.created_at,
                payment: {
                    bank_id: bankConfig.bankId,
                    account_no: bankConfig.accountNo,
                    account_name: bankConfig.accountName,
                    transfer_content: transferContent,
                    qr_url: qrUrl,
                },
            },
        });
    } catch (error) {
        console.error('[OrderLookup] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
