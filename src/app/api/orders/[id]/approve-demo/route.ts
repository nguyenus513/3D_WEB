/**
 * User Demo Approval API
 * POST /api/orders/[id]/approve-demo - Approve demo design
 * DELETE /api/orders/[id]/approve-demo - Reject demo with feedback
 * Uses Supabase Admin REST for reliable status updates (no Direct DB)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireCsrf } from '@/lib/security/csrf';

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const orderId = params.id;

    console.log(`[ApproveDemo] Starting approval for order: ${orderId}`);

    try {
        // 1. Check session
        const session = await auth();
        if (!session?.user?.id) {
            console.error('[ApproveDemo] Error: Unauthorized (No session/user)');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const csrf = await requireCsrf(request);
        if (!csrf.valid) {
            return csrf.error!;
        }

        // 2. Initialize Admin Client
        let supabase;
        try {
            supabase = getAdminSupabase();
        } catch (err) {
            console.error('[ApproveDemo] Error initializing Supabase Admin:', err);
            return NextResponse.json({ error: 'Server Configuration Error' }, { status: 500 });
        }

        // 3. Find order (Unified Table)
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .maybeSingle();

        if (fetchError) {
            console.error('[ApproveDemo] DB Error:', fetchError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        if (!order) {
            console.error('[ApproveDemo] Error: Order not found ID:', orderId);
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const targetTable = 'orders';

        if (!order) {
            console.error('[ApproveDemo] Error: Order not found ID:', orderId);
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Verify ownership
        if (order.user_id !== session.user.id) {
            console.error(`[ApproveDemo] Error: Forbidden. Owner: ${order.user_id}, Requester: ${session.user.id}`);
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        console.log(`[ApproveDemo] Found order in '${targetTable}' with status '${order.status}'`);

        // Virtual Status Logic: Treat as 'review' if demo_image_url exists
        // matching the logic in AdminOrderController and lookup/route.ts
        if (order.demo_image_url && ['pending', 'confirmed', 'designing'].includes(order.status)) {
            console.log('[ApproveDemo] Virtual Status override: processing as review');
            // Allow to proceed
        } else if (order.status !== 'review') {
            if (order.status === 'approved') {
                console.log('[ApproveDemo] Order already approved. Returning success.');
                return NextResponse.json({ success: true, message: 'Already approved', new_status: 'approved' });
            }
            console.error(`[ApproveDemo] Error: Invalid status '${order.status}'`);
            return NextResponse.json({ error: 'Order is not in review status' }, { status: 400 });
        }

        // 4. Update status
        let newStatus = 'production_pending';

        // LOGIC MỚI: Luôn chuyển sang 'production_pending' khi khách duyệt
        // Bỏ check thanh toán ở đây vì khách muốn qua giai đoạn sản xuất luôn 
        // (Admin có thể check lại tiền cọc ở trang quản lý sau)
        newStatus = 'production_pending';

        console.log(`[ApproveDemo] Payment Status: ${order.payment_status} -> New Status: ${newStatus}`);
        console.log(`[ApproveDemo] Updating status to '${newStatus}' in ${targetTable}...`);

        const { error: updateError } = await supabase
            .from(targetTable)
            .update({
                status: newStatus,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('[ApproveDemo] DB Update Error:', updateError.message);
            return NextResponse.json({ error: 'Update failed: ' + updateError.message }, { status: 500 });
        }

        console.log('[ApproveDemo] Approval successful!');

        // 5. Invalidate Cache
        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');
        revalidatePath('/sys_internal/orders', 'page');
        revalidatePath(`/account/orders/${orderId}`, 'page');
        revalidatePath('/account/orders', 'page');

        return NextResponse.json({
            success: true,
            message: 'Demo approved successfully',
            new_status: newStatus
        });

    } catch (error) {
        console.error('[ApproveDemo] Unhandled Exception:', error);
        return NextResponse.json({ error: 'Internal server error: ' + (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const orderId = params.id;

    console.log(`[RejectDemo] Starting rejection for order: ${orderId}`);

    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const csrf = await requireCsrf(request);
        if (!csrf.valid) {
            return csrf.error!;
        }

        const body = await request.json().catch(() => ({}));
        const feedback = body.feedback || 'User requested revision';

        const supabase = getAdminSupabase();

        // Lookup logic (Unified)
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('id, user_id, status, notes')
            .eq('id', orderId)
            .maybeSingle();

        if (fetchError) {
            console.error('[RejectDemo] DB Error:', fetchError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        const targetTable = 'orders';

        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

        if (order.user_id !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        if (order.status !== 'review') return NextResponse.json({ error: 'Order is not in review status' }, { status: 400 });

        console.log(`[RejectDemo] Updating status to 'revising' in ${targetTable}...`);
        const { error: updateError } = await supabase
            .from(targetTable)
            .update({
                status: 'revising',
                notes: order?.notes
                    ? `${order.notes}\n[Revision Request] ${feedback}`
                    : `[Revision Request] ${feedback}`,
                revising_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('[RejectDemo] DB Update Error:', updateError.message);
            return NextResponse.json({ error: 'Failed to reject demo: ' + updateError.message }, { status: 500 });
        }

        console.log('[RejectDemo] Rejection successful!');

        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');
        revalidatePath('/sys_internal/orders', 'page');
        revalidatePath(`/account/orders/${orderId}`, 'page');
        revalidatePath('/account/orders', 'page');

        return NextResponse.json({
            success: true,
            message: 'Demo rejected, revision requested',
            new_status: 'revising'
        });
    } catch (error) {
        console.error('[RejectDemo] Unhandled Exception:', error);
        return NextResponse.json({ error: 'Internal server error: ' + (error as Error).message }, { status: 500 });
    }
}
