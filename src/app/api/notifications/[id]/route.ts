/**
 * Mark Single Notification as Read
 * PATCH /api/notifications/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: notificationId } = await props.params;
        const supabase = getAdminSupabase();

        const profileId = await getProfileId(session.user, supabase);
        if (!profileId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 401 });
        }

        // Verify ownership and update
        const { data, error } = await supabase
            .from('notifications')
            .update({
                is_read: true,
                read_at: new Date().toISOString(),
            })
            .eq('id', notificationId)
            .eq('user_id', profileId)
            .select('id')
            .maybeSingle();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data) {
            return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[MarkRead] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
