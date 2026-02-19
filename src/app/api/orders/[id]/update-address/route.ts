/**
 * Order Address Update API
 * Updates shipping address for an existing order
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verify session
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
                { status: 401 }
            );
        }

        const { id } = await params;
        const supabase = getAdminSupabase();

        // Get profile ID
        const userId = await getProfileId(session.user, supabase);
        if (!userId) {
            return NextResponse.json(
                { success: false, error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found' } },
                { status: 400 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { shipping_address, total } = body;

        // Verify order ownership
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('id, user_id')
            .eq('id', id)
            .single();

        if (fetchError || !order) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 }
            );
        }

        if (order.user_id !== userId) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Cannot update this order' } },
                { status: 403 }
            );
        }

        // Build update object
        const updates: Record<string, unknown> = {};
        if (shipping_address) updates.shipping_address_snapshot = shipping_address;
        if (typeof total === 'number') updates.total_amount = total;
        updates.updated_at = new Date().toISOString();

        // Update order
        const { error: updateError } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', id);

        if (updateError) {
            console.error('[Update Address API] Update error:', updateError);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: updateError.message } },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Update Address API] Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
            { status: 500 }
        );
    }
}
