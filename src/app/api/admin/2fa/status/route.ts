/**
 * 2FA Status API
 *
 * GET /api/admin/2fa/status
 * Returns the current 2FA status for the authenticated admin.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const role = (session.user as { role?: string }).role;
        if (role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = getAdminSupabase();
        const { data: profile } = await supabase
            .from('profiles')
            .select('totp_enabled')
            .eq('id', session.user.id)
            .single();

        return NextResponse.json({
            enabled: profile?.totp_enabled || false,
        });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
