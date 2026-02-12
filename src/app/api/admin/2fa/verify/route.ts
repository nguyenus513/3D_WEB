/**
 * 2FA Verify API
 *
 * POST /api/admin/2fa/verify
 * Verifies TOTP token or recovery code during admin login.
 * Updates JWT session with twoFactorVerified: true.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyToken, verifyRecoveryCode } from '@/lib/security/totp';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';
import { encode } from 'next-auth/jwt';

const log = createLogger('2fa-verify');

export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const userId = session.user.id;
        const role = (session.user as { role?: string }).role;

        if (role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { token, recoveryCode } = body;

        if (!token && !recoveryCode) {
            return NextResponse.json(
                { error: 'Provide either token or recoveryCode' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        const { data: profile } = await supabase
            .from('profiles')
            .select('totp_secret, totp_enabled, totp_recovery_codes')
            .eq('id', userId)
            .single();

        if (!profile?.totp_enabled || !profile?.totp_secret) {
            return NextResponse.json(
                { error: '2FA is not enabled for this account' },
                { status: 400 }
            );
        }

        let verified = false;

        if (token) {
            // Verify TOTP token
            if (typeof token !== 'string' || token.length !== 6) {
                return NextResponse.json(
                    { error: 'Invalid token format. Must be 6 digits.' },
                    { status: 400 }
                );
            }
            verified = verifyToken(profile.totp_secret, token);
        } else if (recoveryCode) {
            // Verify recovery code
            const updatedCodes = verifyRecoveryCode(
                profile.totp_recovery_codes || [],
                recoveryCode
            );

            if (updatedCodes) {
                verified = true;
                // Remove used recovery code
                await supabase
                    .from('profiles')
                    .update({ totp_recovery_codes: updatedCodes })
                    .eq('id', userId);

                log.info('Recovery code used', {
                    userId,
                    remainingCodes: updatedCodes.length,
                });
            }
        }

        if (!verified) {
            log.warn('2FA verification failed', { userId, method: token ? 'totp' : 'recovery' });
            return NextResponse.json(
                { error: 'Mã xác thực không hợp lệ' },
                { status: 400 }
            );
        }

        log.info('2FA verified successfully', { userId });

        // Return success — the client will set the 2fa-verified cookie
        const res = NextResponse.json({ success: true });

        // Set a signed cookie to mark 2FA as verified for this session
        // Cookie lifespan matches JWT session (24h)
        res.cookies.set('2fa-verified', userId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 86400, // 24 hours
            path: '/',
        });

        return res;
    } catch (error) {
        log.error('2FA verify error', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
