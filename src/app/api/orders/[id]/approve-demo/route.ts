/**
 * User Demo Approval API (Design Versioning)
 * POST /api/orders/[id]/approve-demo - Approve latest design version
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
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.user_id !== profileId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (order.status !== 'review') {
            return NextResponse.json({ error: 'Order is not in review status' }, { status: 400 });
        }

        // Find latest pending_review version
        const { data: latestVersion, error: versionError } = await supabase
            .from('design_versions')
            .select('id, version_number')
            .eq('order_id', orderId)
            .eq('status', 'pending_review')
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (versionError) {
            console.error('[ApproveDemo] Version lookup error:', versionError);
        }

        // Update version status to approved (if versioned)
        if (latestVersion) {
            await supabase
                .from('design_versions')
                .update({
                    status: 'approved',
                    reviewed_at: new Date().toISOString(),
                })
                .eq('id', latestVersion.id);
        }

        // Update order status to approved
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

        return NextResponse.json({
            success: true,
            status: 'approved',
            version: latestVersion?.version_number || null,
        });
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

        // Find latest pending_review version and reject it
        const { data: latestVersion } = await supabase
            .from('design_versions')
            .select('id, version_number')
            .eq('order_id', orderId)
            .eq('status', 'pending_review')
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (latestVersion) {
            await supabase
                .from('design_versions')
                .update({
                    status: 'rejected',
                    user_feedback: feedback,
                    reviewed_at: new Date().toISOString(),
                })
                .eq('id', latestVersion.id);
        }

        // Update order status to revising + increment revision count
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'revising',
                revision_feedback: feedback,
                revision_count: (latestVersion?.version_number || 0),
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('[RejectDemo] Update failed:', updateError);
            return NextResponse.json({ error: 'Update failed: ' + updateError.message }, { status: 500 });
        }

        // Invalidate caches
        revalidatePath(`/account/orders/${orderId}`, 'page');
        revalidatePath('/account/orders', 'page');
        revalidatePath(`/sys_internal/orders/${orderId}`, 'page');

        return NextResponse.json({
            success: true,
            status: 'revising',
            rejected_version: latestVersion?.version_number || null,
        });
    } catch (error) {
        console.error('[RejectDemo] Error:', error);
        return NextResponse.json({ error: 'Internal error: ' + (error as Error).message }, { status: 500 });
    }
}
