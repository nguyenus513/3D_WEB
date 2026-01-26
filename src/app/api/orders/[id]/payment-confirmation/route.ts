/**
 * Payment Confirmation API Route
 *
 * Called when customer clicks "Tôi đã chuyển khoản".
 * Updates order status to pending_confirmation and notifies admin.
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
    try {
        const session = await auth();
        const { id: orderId } = await params;

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        // Get order
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, user_id, order_code, status, total')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
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

        // Update order status
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
            },
        });

        // TODO: Send email notification to admin
        // Can be done via Resend or nodemailer

        return NextResponse.json({
            success: true,
            message: 'Đã gửi xác nhận thanh toán. Admin sẽ kiểm tra và xác nhận sớm nhất.'
        });
    } catch (error) {
        console.error('[PaymentConfirmation] Error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}
