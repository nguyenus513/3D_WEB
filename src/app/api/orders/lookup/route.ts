/**
 * Single Order Lookup API
 * GET /api/orders/lookup?id=xxx
 * 
 * Searches across all order tables to find a specific order
 * Used by checkout success page to display QR
 * Uses DIRECT PostgreSQL for status/demo_image_url to bypass REST API cache
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';
import { getProfileId } from '@/lib/utils/getProfileId';
import { getBankConfigForOrderTypeAsync, BANK_INFO, type BankCode } from '@/lib/vietqr';
import { dbRequest } from '@/lib/db-direct';

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

        // 1a. Try custom_orders by order_number
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

        // 1c. Try custom_orders by id (UUID)
        if (!order) {
            const { data: customById } = await supabaseAdmin
                .from('custom_orders')
                .select('*')
                .eq('user_id', userId)
                .eq('id', orderId)
                .maybeSingle();

            if (customById) {
                order = customById;
                orderType = 'custom';
                console.log('[OrderLookup] Found in custom_orders by id');
            }
        }

        // 2a. Try print_orders by order_number
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
                console.log('[OrderLookup] Found in print_orders by order_number');
            }
        }

        // 2b. Try print_orders by id (UUID)
        if (!order) {
            const { data: printById } = await supabaseAdmin
                .from('print_orders')
                .select('*')
                .eq('user_id', userId)
                .eq('id', orderId)
                .maybeSingle();

            if (printById) {
                order = printById;
                orderType = 'printing';
                console.log('[OrderLookup] Found in print_orders by id');
            }
        }

        // 3a. Try orders table by order_code
        if (!order) {
            const { data: readyMadeOrder } = await supabaseAdmin
                .from('orders')
                .select('*, items:order_items(*)')
                .eq('user_id', userId)
                .eq('order_code', orderId)
                .maybeSingle();

            if (readyMadeOrder) {
                order = readyMadeOrder;
                orderType = 'ready_made';
                console.log('[OrderLookup] Found in orders by order_code');
            }
        }

        // 3b. Try orders table by id (UUID)
        if (!order) {
            const { data: ordersById } = await supabaseAdmin
                .from('orders')
                .select('*, items:order_items(*)')
                .eq('user_id', userId)
                .eq('id', orderId)
                .maybeSingle();

            if (ordersById) {
                order = ordersById;
                orderType = 'ready_made';
                console.log('[OrderLookup] Found in orders by id');
            }
        }

        // 4a. Try master_orders by order_number
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
                console.log('[OrderLookup] Found in master_orders by order_number');
            }
        }

        // 4b. Try master_orders by id (UUID)
        if (!order) {
            const { data: masterById } = await supabaseAdmin
                .from('master_orders')
                .select('*, address:addresses(*)')
                .eq('user_id', userId)
                .eq('id', orderId)
                .maybeSingle();

            if (masterById) {
                order = masterById;
                orderType = 'ready_made';
                console.log('[OrderLookup] Found in master_orders by id');
            }
        }

        if (!order) {
            console.log('[OrderLookup] Order not found in any table');
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Generate QR info - use async version to fetch from database
        const total = order.total || order.total_amount || order.total_price || order.estimated_price || 0;
        const depositAmount = order.deposit_amount || Math.round(total * 0.5);
        const bankConfig = await getBankConfigForOrderTypeAsync(orderType);
        const transferContent = `MINWSUN_${order.order_number || order.order_code || orderId}`;
        const qrUrl = `https://img.vietqr.io/image/${bankConfig.bankId}-${bankConfig.accountNo}-compact2.png?amount=${depositAmount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bankConfig.accountName)}`;

        // Normalize items for response
        let items = [];
        if (orderType === 'ready_made') {
            items = order.items || [];
        } else if (orderType === 'custom') {
            items = [{
                name: order.description || 'Đơn hàng Custom',
                quantity: order.quantity || 1,
                total_price: total
            }];
        } else if (orderType === 'printing') {
            items = [{
                name: `In 3D - ${order.print_type || 'FDM'}`,
                quantity: order.quantity || 1,
                total_price: total
            }];
        }

        // === CRITICAL: Bypass Supabase REST API cache using direct PostgreSQL ===
        // The order object from Supabase may have stale status/demo_image_url
        let finalStatus = order.status;
        let finalDemoUrl = order.demo_image_url;

        if (orderType === 'custom' || orderType === 'printing') {
            // SỬ DỤNG SUPABASE CLIENT ĐỂ LẤY DỮ LIỆU TƯƠI (Thay thế cho Direct DB đang lỗi)
            try {
                const tableName = orderType === 'custom' ? 'custom_orders' : 'print_orders';
                console.log(`[OrderLookup] Querying fresh data via Supabase Admin from ${tableName} for ${order.id}`);

                const { data: freshOrder, error: freshError } = await supabaseAdmin
                    .from(tableName)
                    .select('status, demo_image_url')
                    .eq('id', order.id)
                    .single();

                if (!freshError && freshOrder) {
                    console.log(`[OrderLookup] Updated status via Supabase: ${freshOrder.status}`);
                    // Ghi đè dữ liệu cũ
                    finalStatus = freshOrder.status || finalStatus;
                    if (freshOrder.demo_image_url) {
                        finalDemoUrl = freshOrder.demo_image_url;
                    }
                } else if (freshError) {
                    console.warn('[OrderLookup] Supabase refresh failed:', freshError.message);
                }
            } catch (err) {
                console.error('[OrderLookup] Failed to refresh data:', err);
            }
        }

        // Virtual Status Logic fallback: If demo_image_url exists but status is stuck, override to 'review'
        if (finalDemoUrl && ['pending', 'confirmed', 'designing'].includes(finalStatus)) {
            finalStatus = 'review';
        }

        return NextResponse.json({
            success: true,
            data: {
                id: order.id,
                order_code: order.order_number || order.order_code,
                order_type: orderType,
                total,
                deposit_amount: depositAmount,
                status: finalStatus,
                payment_status: order.payment_status || 'pending',
                shipping_address: order.shipping_address || order.address,
                created_at: order.created_at,
                items: items,
                custom_config: order.custom_config,
                printing_config: {
                    type: order.print_type || order.print_tech,
                    color: order.color,
                    quantity: order.quantity,
                    files: order.files || (order.file_url ? [{ url: order.file_url, name: 'File 3D' }] : []),
                    analysis: { grams: order.grams, hours: order.hours }
                },
                demo_image_url: finalDemoUrl,
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
