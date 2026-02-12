/**
 * 2FA Enable API
 *
 * POST /api/admin/2fa/enable
 * Verifies the TOTP token and enables 2FA with recovery codes.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { verifyToken, generateRecoveryCodes } from '@/lib/security/totp';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';
import { auditLog } from '@/lib/audit';

const log = createLogger('2fa-enable');

export async function POST(request: Request) {
    const { authorized, response, userId } = await requireAdmin(request);
    if (!authorized || !userId) return response;

    try {
        const body = await request.json();
        const { token } = body;

        if (!token || typeof token !== 'string' || token.length !== 6) {
            return NextResponse.json(
                { error: 'Invalid token. Must be 6 digits.' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        // Get the pending secret
        const { data: profile } = await supabase
            .from('profiles')
            .select('totp_secret, totp_enabled')
            .eq('id', userId)
            .single();

        if (!profile?.totp_secret) {
            return NextResponse.json(
                { error: 'No 2FA setup in progress. Call /api/admin/2fa/setup first.' },
                { status: 400 }
            );
        }

        if (profile.totp_enabled) {
            return NextResponse.json(
                { error: '2FA is already enabled.' },
                { status: 400 }
            );
        }

        // Verify the token
        const isValid = verifyToken(profile.totp_secret, token);
        if (!isValid) {
            return NextResponse.json(
                { error: 'Invalid verification code. Please try again.' },
                { status: 400 }
            );
        }

        // Generate recovery codes
        const { plainCodes, hashedCodes } = generateRecoveryCodes();

        // Enable 2FA
        await supabase
            .from('profiles')
            .update({
                totp_enabled: true,
                totp_recovery_codes: hashedCodes,
            })
            .eq('id', userId);

        log.info('2FA enabled', { userId });
        await auditLog(userId, 'UPDATE_SETTINGS', 'settings', userId, { action: '2fa_enabled' }, request);

        return NextResponse.json({
            success: true,
            recoveryCodes: plainCodes,
            message: 'Lưu recovery codes ở nơi an toàn. Mỗi code chỉ dùng được 1 lần.',
        });
    } catch (error) {
        log.error('2FA enable failed', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
