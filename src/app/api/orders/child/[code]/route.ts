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

        if (!code || code.length !== 12) {
            return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
        }

        const upperCode = code.toUpperCase();

        // Fetch order with all data including bank info in metadata
        const { data: order, error: orderError } = await supabaseAdmin
            .from('order_child')
            .select('*')
            .eq('code_child', upperCode)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            order: {
                id: order.id,
                code_child: order.code_child,
                product_name: order.product_name,
                product_type: order.product_type,
                quantity: order.quantity,
                unit_price: order.unit_price,
                total_price: order.total_price,
                status: order.status,
                payment_qr_url: order.payment_qr_url,
                metadata: order.metadata, // Contains bank_code, account_no, account_name
                created_at: order.created_at,
            }
        });
    } catch (error) {
        console.error('[GetChildOrder] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
