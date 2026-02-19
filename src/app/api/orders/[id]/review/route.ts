/**
 * Customer Review API
 * POST /api/orders/[id]/review - Customer approves or rejects design
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabase } from '@/lib/supabase/client';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verify user is authenticated
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: orderId } = await params;
        if (!orderId) {
            return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
        }

        const { action } = await request.json();
        if (!action || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const supabase = getSupabase();

        // Get user ID
        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('email', session.user.email)
            .single();

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get order and verify ownership
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, status, user_id')
            .eq('id', orderId)
            .eq('user_id', user.id)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Verify order is in review status
        if (order.status !== 'review') {
            return NextResponse.json({
                error: 'Order is not awaiting review'
            }, { status: 400 });
        }

        // Update order status based on action
        const newStatus = action === 'approve' ? 'approved' : 'revising';
        const updateData: Record<string, string> = { status: newStatus };

        if (action === 'approve') {
            updateData.approved_at = new Date().toISOString();
        }

        const { error: updateError } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId);

        if (updateError) {
            console.error('Update order error:', updateError);
            return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            status: newStatus,
            message: action === 'approve'
                ? 'Design approved! Order will proceed to production.'
                : 'Revision requested. We will update the design.',
        });
    } catch (error) {
        console.error('Review API error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
