/**
 * Get Child Order by Code
 * GET /api/orders/child/[code]
 * 
 * Returns order details with bank info from metadata
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;

        if (!code || code.length < 8) {
            return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
        }

        const upperCode = code.toUpperCase();

        // Fetch order from Unified 'orders' table
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('*, order_items(*)')
            .eq('order_code', upperCode)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Fetch payment info for QR URL
        let qrUrl = null;
        let bankInfo: any = {};
        if (order.payment_status === 'pending') {
            const { data: payment } = await supabaseAdmin
                .from('payments')
                .select('transaction_code, gateway_response')
                .eq('order_id', order.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (payment && payment.gateway_response && typeof payment.gateway_response === 'object') {
                const gateway = payment.gateway_response as any;
                qrUrl = gateway.qr_url || null;
                bankInfo = {
                    bank_code: gateway.bank_code,
                    account_no: gateway.account_no,
                    account_name: gateway.account_name,
                    transfer_content: payment.transaction_code || gateway.reference_code,
                };
            }
        }

        // Parse items to get product details (Legacy support uses first item)
        const relationalItems = Array.isArray(order.order_items) ? order.order_items : [];
        const jsonItems = Array.isArray(order.items) ? order.items : [];
        const items = relationalItems.length > 0 ? relationalItems : jsonItems;
        const firstItem = items[0] || {};

        // Construct metadata for frontend compatibility
        // The original metadata had flat bank info keys
        const metadata = {
            ...(firstItem.configuration || {}),
            bank_code: bankInfo.bank_code,
            account_no: bankInfo.account_no,
            account_name: bankInfo.account_name,
            transfer_content: bankInfo.transfer_content,
        };

        return NextResponse.json({
            success: true,
            order: {
                id: order.id,
                code_child: order.order_code,
                product_name: firstItem.name || 'Order',
                product_type: firstItem.type || 'product',
                quantity: firstItem.quantity || 1,
                unit_price: firstItem.unit_price || order.total_amount,
                total_price: order.total_amount,
                status: order.status,
                payment_qr_url: qrUrl,
                metadata: metadata,
                created_at: order.created_at,
            }
        });
    } catch (error) {
        console.error('[GetChildOrder] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
