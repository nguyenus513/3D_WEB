/**
 * Payment Confirmation API Route
 *
 * Called when customer clicks "Tôi đã chuyển khoản".
 * Updates order status to pending_confirmation and notifies admin.
 * 
 * Supports both legacy orders table and new order_child table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';
import { SecurityLogger, getClientIP } from '@/lib/security';

// Supabase Admin
const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

/**
 * POST /api/orders/[id]/payment-confirmation
 * Customer confirms they have made the bank transfer
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    console.log('[PaymentConfirmation] API CALLED');
    try {
        const { id: orderId } = await params;
        console.log('[PaymentConfirmation] Order ID:', orderId);

        const session = await auth();

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        // Try order_child first (new system)
        let order = null;
        let orderTable = 'order_child';

        const { data: childOrder } = await supabaseAdmin
            .from('order_child')
            .select('id, user_id, code_child, status, total_price')
            .eq('id', orderId)
            .single();

        if (childOrder) {
            order = {
                id: childOrder.id,
                user_id: childOrder.user_id,
                order_code: childOrder.code_child,
                status: childOrder.status,
                total: childOrder.total_price,
            };
        } else {
            // Fallback to legacy orders table
            const { data: legacyOrder } = await supabaseAdmin
                .from('orders')
                .select('id, user_id, order_code, status, total')
                .eq('id', orderId)
                .single();

            if (legacyOrder) {
                order = legacyOrder;
                orderTable = 'orders';
            }
        }

        if (!order) {
            return NextResponse.json({ error: 'Đơn hàng không tồn tại' }, { status: 404 });
        }

        // Verify ownership (allow if logged in user owns order, or guest order)
        if (session?.user?.id && order.user_id && session.user.id !== order.user_id) {
            return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
        }

        // Check if order is in correct state
        if (!['pending', 'expired'].includes(order.status)) {
            return NextResponse.json({
                error: 'Đơn hàng đã được xử lý hoặc không ở trạng thái chờ thanh toán'
            }, { status: 400 });
        }

        // Update order status based on table type
        if (orderTable === 'order_child') {
            const { error: updateError } = await supabaseAdmin
                .from('order_child')
                .update({
                    status: 'pending_confirmation',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', orderId);

            if (updateError) {
                console.error('[PaymentConfirmation] Update error:', updateError);
                return NextResponse.json({ error: 'Không thể cập nhật đơn hàng' }, { status: 500 });
            }
        } else {
            const { error: updateError } = await supabaseAdmin
                .from('orders')
                .update({
                    status: 'pending_confirmation',
                    payment_confirmed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', orderId);

            if (updateError) {
                console.error('[PaymentConfirmation] Update error:', updateError);
                return NextResponse.json({ error: 'Không thể cập nhật đơn hàng' }, { status: 500 });
            }
        }

        // Log security event
        await SecurityLogger.log({
            event_type: 'ADMIN_ACTION',
            severity: 'INFO',
            user_id: session?.user?.id || null,
            ip_address: getClientIP(request),
            details: {
                action: 'payment_confirmation_submitted',
                orderId,
                orderCode: order.order_code,
                total: order.total,
                orderTable,
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Đã gửi xác nhận thanh toán. Admin sẽ kiểm tra và xác nhận sớm nhất.'
        });
    } catch (error) {
        console.error('[PaymentConfirmation] Error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}
