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
        let orderTable: 'order_child' | 'orders' = 'order_child';

        const { data: childOrder } = await supabaseAdmin
            .from('order_child')
            .select('id, user_id, code_child, status, total_price')
            .eq('id', orderId)
            .maybeSingle();

        if (childOrder) {
            order = {
                id: childOrder.id,
                user_id: childOrder.user_id,
                order_code: childOrder.code_child,
                status: childOrder.status,
                total: childOrder.total_price,
            };
        } else {
            const { data: legacyOrder } = await supabaseAdmin
                .from('orders')
                .select('id, user_id, order_code, status, total_amount')
                .eq('id', orderId)
                .maybeSingle();

            if (legacyOrder) {
                order = {
                    id: legacyOrder.id,
                    user_id: legacyOrder.user_id,
                    order_code: legacyOrder.order_code,
                    status: legacyOrder.status,
                    total: legacyOrder.total_amount,
                };
                orderTable = 'orders';
            }
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

        const updatePayload = orderTable === 'order_child'
            ? { status: 'pending_confirmation', updated_at: new Date().toISOString() }
            : { status: 'pending_confirmation', payment_status: 'pending', updated_at: new Date().toISOString() };

        const { error: updateError } = await supabaseAdmin
            .from(orderTable)
            .update(updatePayload)
            .eq('id', orderId);

        if (updateError) {
            log.error('Update error', updateError);
            return NextResponse.json({ error: 'Không thể cập nhật đơn hàng' }, { status: 500 });
        }

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
            message: 'Đã gửi xác nhận thanh toán. Admin sẽ kiểm tra và xác nhận sớm nhất.',
            status: 'pending_confirmation',
        });
    } catch (error) {
        log.error('Unhandled error', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}
