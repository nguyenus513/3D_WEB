/**
 * User Demo Approval API
 * POST /api/orders/[id]/approve-demo - Approve demo design
 * DELETE /api/orders/[id]/approve-demo - Request revision with feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: orderId } = await props.params;
        const supabase = getAdminSupabase();

        // Resolve correct profile ID (session.user.id may differ from users.id)
        const profileId = await getProfileId(session.user, supabase);
        if (!profileId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 401 });
        }

        // Find order and verify ownership
        const { data: order, error: findError } = await supabase
            .from('orders')
            .select('id, user_id, status')
            .eq('id', orderId)
            .maybeSingle();

        if (findError || !order) {
            console.warn('[ApproveDemo] Order not found:', { orderId, findError: findError?.message });
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.user_id !== profileId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (order.status !== 'review') {
            return NextResponse.json({ error: 'Order is not in review status' }, { status: 400 });
        }

        // Update status to approved with timestamp
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'approved',
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('[ApproveDemo] Update failed:', updateError);
            return NextResponse.json({ error: 'Update failed: ' + updateError.message }, { status: 500 });
        }

        // Invalidate caches
        revalidatePath(`/account/orders/${orderId}`, 'page');
        revalidatePath('/account/orders', 'page');
        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');

        return NextResponse.json({ success: true, status: 'approved' });
    } catch (error) {
        console.error('[ApproveDemo] Error:', error);
        return NextResponse.json({ error: 'Internal error: ' + (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        console.log('[DELETE approve-demo] Handler hit');
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: orderId } = await props.params;
        const body = await request.json().catch(() => ({}));
        const feedback = body.feedback || 'Cần chỉnh sửa thêm';

        const supabase = getAdminSupabase();

        // Resolve correct profile ID
        const profileId = await getProfileId(session.user, supabase);
        if (!profileId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 401 });
        }

        // Find order and verify ownership
        const { data: order, error: findError } = await supabase
            .from('orders')
            .select('id, user_id, status')
            .eq('id', orderId)
            .maybeSingle();

        if (findError || !order) {
            console.warn('[RejectDemo] Order not found:', { orderId, findError: findError?.message });
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.user_id !== profileId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (order.status !== 'review') {
            return NextResponse.json({ error: 'Order is not in review status' }, { status: 400 });
        }

        // Increment revision count safely
        // Use raw SQL via rpc for atomic increment
        const { error: updateError } = await supabase.rpc('exec_sql', {
            query: `UPDATE orders SET 
                status = 'revising', 
                revision_feedback = $1, 
                revision_count = COALESCE(revision_count, 0) + 1, 
                updated_at = NOW() 
            WHERE id = $2`,
            params: [feedback, orderId]
        }).maybeSingle();

        // Fallback: if rpc doesn't exist, use regular update
        if (updateError) {
            console.warn('[RejectDemo] RPC failed, using regular update:', updateError.message);
            const { error: fallbackError } = await supabase
                .from('orders')
                .update({
                    status: 'revising',
                    revision_feedback: feedback,
                    revision_count: 1,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', orderId);

            if (fallbackError) {
                console.error('[RejectDemo] Update failed:', fallbackError);
                return NextResponse.json({ error: 'Update failed: ' + fallbackError.message }, { status: 500 });
            }
        }

        // Invalidate caches
        revalidatePath(`/account/orders/${orderId}`, 'page');
        revalidatePath('/account/orders', 'page');
        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');

        return NextResponse.json({
            success: true,
            status: 'revising',
        });
    } catch (error) {
        console.error('[RejectDemo] Error:', error);
        return NextResponse.json({ error: 'Internal error: ' + (error as Error).message }, { status: 500 });
    }
}
