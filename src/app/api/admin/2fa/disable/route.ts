/**
 * 2FA Disable API
 *
 * POST /api/admin/2fa/disable
 * Disables 2FA after verifying current TOTP token.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { verifyToken } from '@/lib/security/totp';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';
import { auditLog } from '@/lib/audit';

const log = createLogger('2fa-disable');

export async function POST(request: Request) {
    const { authorized, response, userId } = await requireAdmin(request);
    if (!authorized || !userId) return response;

    try {
        const body = await request.json();
        const { token } = body;

        if (!token || typeof token !== 'string' || token.length !== 6) {
            return NextResponse.json(
                { error: 'Must verify with current TOTP code to disable 2FA.' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        const { data: profile } = await supabase
            .from('profiles')
            .select('totp_secret, totp_enabled')
            .eq('id', userId)
            .single();

        if (!profile?.totp_enabled || !profile?.totp_secret) {
            return NextResponse.json(
                { error: '2FA is not currently enabled.' },
                { status: 400 }
            );
        }

        // Verify current token before disabling
        const isValid = verifyToken(profile.totp_secret, token);
        if (!isValid) {
            return NextResponse.json(
                { error: 'Invalid verification code.' },
                { status: 400 }
            );
        }

        // Disable 2FA — clear all secrets
        await supabase
            .from('profiles')
            .update({
                totp_enabled: false,
                totp_secret: null,
                totp_recovery_codes: null,
            })
            .eq('id', userId);

        log.info('2FA disabled', { userId });
        await auditLog(userId, 'UPDATE_SETTINGS', 'settings', userId, { action: '2fa_disabled' }, request);

        // Clear the 2FA cookie
        const res = NextResponse.json({
            success: true,
            message: '2FA has been disabled.',
        });

        res.cookies.delete('2fa-verified');

        return res;
    } catch (error) {
        log.error('2FA disable failed', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
