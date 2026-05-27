import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { verifyToken, generateRecoveryCodes } from '@/lib/security/totp';
import { getMongoCollections } from '@/lib/mongodb';
import { createLogger } from '@/lib/logger';
import { auditLog } from '@/lib/audit';
import { createTwoFactorCookie, getTwoFactorCookieName, getTwoFactorSessionFingerprint } from '@/lib/security/twofa-cookie';

const log = createLogger('2fa-enable');

export async function POST(request: NextRequest) {
    const { authorized, response, userId, session } = await requireAdmin(request, true);
    if (!authorized || !userId) return response;

    try {
        const { token } = await request.json();
        if (!token || typeof token !== 'string' || token.length !== 6) {
            return NextResponse.json({ error: 'Invalid token. Must be 6 digits.' }, { status: 400 });
        }

        const { profiles } = await getMongoCollections();
        const profile = await profiles.findOne({ _id: userId });
        if (!profile?.totp_secret) return NextResponse.json({ error: 'No 2FA setup in progress. Please start setup again.' }, { status: 400 });
        if (profile.totp_enabled) return NextResponse.json({ error: '2FA is already enabled.' }, { status: 400 });
        if (!verifyToken(profile.totp_secret, token)) return NextResponse.json({ error: 'Invalid verification code.' }, { status: 400 });

        const { plainCodes, hashedCodes } = generateRecoveryCodes();
        await profiles.updateOne(
            { _id: userId },
            { $set: { totp_enabled: true, totp_recovery_codes: hashedCodes, updated_at: new Date() } }
        );

        log.info('2FA enabled', { userId });
        await auditLog(userId, 'UPDATE_SETTINGS', 'settings', userId, { action: '2fa_enabled' }, request);

        const cookieValue = await createTwoFactorCookie({
            userId,
            email: session?.user?.email,
            sessionFingerprint: await getTwoFactorSessionFingerprint(request.cookies),
        });
        const res = NextResponse.json({ success: true, recoveryCodes: plainCodes });
        res.cookies.set(getTwoFactorCookieName(), cookieValue, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 86400,
            path: '/',
        });
        return res;
    } catch (error) {
        log.error('2FA enable failed', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
