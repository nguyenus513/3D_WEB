import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { verifyToken, verifyRecoveryCode } from '@/lib/security/totp';
import { getMongoCollections } from '@/lib/mongodb';
import { createLogger } from '@/lib/logger';
import { createTwoFactorCookie, getTwoFactorCookieName, getTwoFactorSessionFingerprint } from '@/lib/security/twofa-cookie';

const log = createLogger('2fa-verify');

export async function POST(request: NextRequest) {
    const { authorized, response, userId, session } = await requireAdmin(request, true);
    if (!authorized || !userId) return response;

    try {
        const { token, recoveryCode } = await request.json();
        if (!token && !recoveryCode) return NextResponse.json({ error: 'Token or recovery code required.' }, { status: 400 });

        const { profiles } = await getMongoCollections();
        const profile = await profiles.findOne({ _id: userId });
        if (!profile?.totp_enabled || !profile?.totp_secret) {
            return NextResponse.json({ error: '2FA is not enabled for this account' }, { status: 400 });
        }

        let verified = false;
        if (token) {
            if (typeof token !== 'string' || token.length !== 6) {
                return NextResponse.json({ error: 'Invalid token format. Must be 6 digits.' }, { status: 400 });
            }
            verified = verifyToken(profile.totp_secret, token);
        } else if (recoveryCode) {
            const updatedCodes = verifyRecoveryCode(profile.totp_recovery_codes || [], recoveryCode);
            if (updatedCodes) {
                verified = true;
                await profiles.updateOne(
                    { _id: userId },
                    { $set: { totp_recovery_codes: updatedCodes, updated_at: new Date() } }
                );
                log.info('Recovery code used', { userId, remainingCodes: updatedCodes.length });
            }
        }

        if (!verified) {
            log.warn('2FA verification failed', { userId, method: token ? 'totp' : 'recovery' });
            return NextResponse.json({ error: 'Mã xác thực không hợp lệ' }, { status: 400 });
        }

        const cookieValue = await createTwoFactorCookie({
            userId,
            email: session?.user?.email,
            sessionFingerprint: await getTwoFactorSessionFingerprint(request.cookies),
        });

        log.info('2FA verified successfully', { userId });
        const res = NextResponse.json({ success: true });
        res.cookies.set(getTwoFactorCookieName(), cookieValue, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 86400,
            path: '/',
        });
        return res;
    } catch (error) {
        log.error('2FA verify error', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
