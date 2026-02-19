/**
 * 2FA Status API
 *
 * GET /api/admin/2fa/status
 * Returns 2FA status and whether admin has already verified.
 * Uses skip2FA so this endpoint is always accessible to admins.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    // skip2FA — this endpoint must always be accessible
    const { authorized, response, userId } = await requireAdmin(request, true);
    if (!authorized || !userId) return response;

    try {
        const supabase = getAdminSupabase();
        const { data: profile } = await supabase
            .from('users')
            .select('totp_enabled')
            .eq('id', userId)
            .single();

        const enabled = profile?.totp_enabled || false;

        // Check if already verified via cookie
        let verified = false;
        if (enabled) {
            const cookieStore = await cookies();
            const twoFACookie = cookieStore.get('2fa-verified');
            verified = twoFACookie?.value === userId;
        }

        return NextResponse.json({ enabled, verified });
    } catch {
        return NextResponse.json({ enabled: false, verified: false });
    }
}
