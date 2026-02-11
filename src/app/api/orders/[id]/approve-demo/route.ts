/**
 * User Demo Approval API
 * POST /api/orders/[id]/approve-demo - Approve demo design
 * DELETE /api/orders/[id]/approve-demo - Reject demo with feedback
 * Uses unified orders table only
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

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
            console.error('[ApproveDemo] Error: Unauthorized');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Initialize Admin Client
        const supabase = getAdminSupabase();

        // 3. Find order in unified orders table
        const { data: order, error: findError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .maybeSingle();

        if (findError || !order) {
            console.error('[ApproveDemo] Error: Order not found ID:', orderId);
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Verify ownership
        if (order.user_id !== session.user.id) {
            console.error(`[ApproveDemo] Error: Forbidden. Owner: ${order.user_id}, Requester: ${session.user.id}`);
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        console.log(`[ApproveDemo] Found order with status '${order.status}'`);

        if (order.status !== 'review') {
            if (order.status === 'approved') {
                console.log('[ApproveDemo] Order already approved');
                return NextResponse.json({ success: true, message: 'Already approved', new_status: 'approved' });
            }
            console.error(`[ApproveDemo] Error: Invalid status '${order.status}'`);
            return NextResponse.json({ error: 'Order is not in review status' }, { status: 400 });
        }

        // 4. Update status to 'approved'
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'approved',
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
            new_status: 'approved'
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

        const body = await request.json().catch(() => ({}));
        const feedback = body.feedback || 'User requested revision';

        const supabase = getAdminSupabase();

        // Find order in unified orders table
        const { data: order, error: findError } = await supabase
            .from('orders')
            .select('id, user_id, status')
            .eq('id', orderId)
            .maybeSingle();

        if (findError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.user_id !== session.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (order.status !== 'review') {
            return NextResponse.json({ error: 'Order is not in review status' }, { status: 400 });
        }

        console.log(`[RejectDemo] Updating status to 'revising'...`);
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'revising',
                notes: feedback,
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
