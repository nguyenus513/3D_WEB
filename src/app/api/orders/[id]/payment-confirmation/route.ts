/**
 * Payment Confirmation API Route
 *
 * Called when customer clicks "Tôi đã chuyển khoản".
 * Updates order status to pending_confirmation and notifies admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { SecurityLogger, getClientIP } from '@/lib/security';
import { sendOrderStatusEmail } from '@/lib/email/orderStatusEmail';

const supabaseAdmin = getAdminSupabase();

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { createLogger } = await import('@/lib/logger');
    const log = createLogger('payment-confirmation');

    try {
        const { id: orderId } = await params;
        const session = await auth();

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        let order: {
            id: string;
            user_id?: string | null;
            order_code: string;
            status: string;
            total: number;
        } | null = null;

        const { data: canonicalOrder } = await supabaseAdmin
            .from('orders')
            .select('id, user_id, order_code, status, total_amount')
            .eq('id', orderId)
            .maybeSingle();

        if (canonicalOrder) {
            order = {
                id: canonicalOrder.id,
                user_id: canonicalOrder.user_id,
                order_code: canonicalOrder.order_code,
                status: canonicalOrder.status,
                total: canonicalOrder.total_amount,
            };
        }

        if (!order) {
            return NextResponse.json({ error: 'Đơn hàng không tồn tại' }, { status: 404 });
        }

        if (session?.user?.id && order.user_id && session.user.id !== order.user_id) {
            return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
        }

        if (!['pending', 'pending_confirmation', 'expired'].includes(order.status)) {
            return NextResponse.json({
                error: 'Đơn hàng đã được xử lý hoặc không ở trạng thái chờ thanh toán',
            }, { status: 400 });
        }

        const updatePayload = { status: 'pending_confirmation', payment_status: 'pending', updated_at: new Date().toISOString() };

        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update(updatePayload)
            .eq('id', orderId);

        if (updateError) {
            log.error('Update error', updateError);
            return NextResponse.json({ error: 'Không thể cập nhật đơn hàng' }, { status: 500 });
        }

        await sendOrderStatusEmail({
            orderId,
            oldStatus: order.status,
            newStatus: 'pending_confirmation',
        });

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
                orderTable: 'orders',
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Đã gửi xác nhận thanh toán. Admin sẽ kiểm tra và xác nhận sớm nhất.',
            status: 'pending_confirmation',
        });
    } catch (error) {
        log.error('Unhandled error', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}
