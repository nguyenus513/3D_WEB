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
import { requireCsrf } from '@/lib/security/csrf';

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
        const { id: orderId } = await params;
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const csrf = await requireCsrf(request);
        if (!csrf.valid) {
            return csrf.error!;
        }

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        const { data: orderData, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('id, user_id, order_code, status, total_amount')
            .eq('id', orderId)
            .single();

        if (fetchError || !orderData) {
            return NextResponse.json({ error: 'Đơn hàng không tồn tại' }, { status: 404 });
        }

        if (orderData.user_id && session.user.id !== orderData.user_id) {
            return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
        }

        if (orderData.status === 'pending_confirmation') {
            return NextResponse.json({
                success: true,
                message: 'Đã gửi xác nhận thanh toán trước đó.'
            });
        }

        if (!['pending', 'expired'].includes(orderData.status)) {
            return NextResponse.json({
                error: 'Đơn hàng đã được xử lý hoặc không ở trạng thái chờ thanh toán'
            }, { status: 400 });
        }

        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({
                status: 'pending_confirmation',
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('[PaymentConfirmation] Update error:', updateError);
            return NextResponse.json({ error: 'Không thể cập nhật đơn hàng' }, { status: 500 });
        }

        await SecurityLogger.log({
            event_type: 'ADMIN_ACTION',
            severity: 'INFO',
            user_id: session.user.id || null,
            ip_address: getClientIP(request),
            details: {
                action: 'payment_confirmation_submitted',
                orderId,
                orderCode: orderData.order_code,
                total: orderData.total_amount,
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
