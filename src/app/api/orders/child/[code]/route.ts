/**
 * Get Child Order by Code
 * GET /api/orders/child/[code]
 * 
 * Returns order item details with payment info from related order
 * Supports both item_code (8 char) and full_code (16+ char) formats
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';
import { getPaymentConfig, generateQRUrl } from '@/lib/services/paymentConfigService';

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

        // Support multiple formats:
        // 1. item_code (8 or 16 chars) - direct lookup
        // 2. full_code ({order_code}_{item_code}) - with underscore
        let orderItem = null;
        let order = null;

        // Check if it's a full_code format (has underscore)
        if (upperCode.includes('_')) {
            // Try by full_code first
            const { data: itemByFullCode } = await supabaseAdmin
                .from('order_items')
                .select(`
                    *,
                    order:orders(*)
                `)
                .eq('full_code', upperCode)
                .single();

            if (itemByFullCode) {
                orderItem = itemByFullCode;
                order = itemByFullCode.order;
            }
        } else {
            // Try by item_code (no underscore)
            const { data: itemByCode } = await supabaseAdmin
                .from('order_items')
                .select(`
                    *,
                    order:orders(*)
                `)
                .eq('item_code', upperCode)
                .single();

            if (itemByCode) {
                orderItem = itemByCode;
                order = itemByCode.order;
            }
        }



        if (!orderItem || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Get bank info for QR
        const orderType = order.order_type || 'ready_made';
        const bankInfo = await getPaymentConfig(orderType);

        // Get customer code from profile
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('customer_code')
            .eq('id', order.user_id)
            .single();

        const customerCode = profile?.customer_code || 'UNKNOWN';
        const transferContent = `${customerCode}${order.order_code}`;

        // Generate QR if bank info available
        let qrUrl = null;
        if (bankInfo) {
            qrUrl = generateQRUrl(
                bankInfo.bank_code,
                bankInfo.account_no,
                bankInfo.account_name,
                Number(orderItem.total_price),
                transferContent
            );
        }

        return NextResponse.json({
            success: true,
            order: {
                id: orderItem.id,
                order_id: order.id,
                item_code: orderItem.item_code,
                full_code: orderItem.full_code,
                order_code: order.order_code,
                product_name: orderItem.name,
                item_type: orderItem.item_type,
                quantity: orderItem.quantity,
                unit_price: Number(orderItem.unit_price),
                total_price: Number(orderItem.total_price),
                status: order.status,
                payment_status: order.payment_status,
                payment_qr_url: qrUrl,
                spec: orderItem.spec,
                created_at: orderItem.created_at,
                // Bank info
                metadata: bankInfo ? {
                    customer_code: customerCode,
                    transfer_content: transferContent,
                    bank_code: bankInfo.bank_code,
                    account_no: bankInfo.account_no,
                    account_name: bankInfo.account_name,
                } : null,
            }
        });
    } catch (error) {
        console.error('[GetChildOrder] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
