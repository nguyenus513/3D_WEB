import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { verifyToken } from '@/lib/security/totp';
import { getMongoCollections } from '@/lib/mongodb';
import { createLogger } from '@/lib/logger';
import { auditLog } from '@/lib/audit';
import { getTwoFactorCookieName } from '@/lib/security/twofa-cookie';

const log = createLogger('2fa-disable');

export async function POST(request: Request) {
    const { authorized, response, userId } = await requireAdmin(request, true);
    if (!authorized || !userId) return response;

    try {
        const { token } = await request.json();
        if (!token || typeof token !== 'string' || token.length !== 6) {
            return NextResponse.json({ error: 'Must verify with current TOTP code to disable 2FA.' }, { status: 400 });
        }

        const { profiles } = await getMongoCollections();
        const profile = await profiles.findOne({ _id: userId });
        if (!profile?.totp_enabled || !profile?.totp_secret) {
            return NextResponse.json({ error: '2FA is not currently enabled.' }, { status: 400 });
        }
        if (!verifyToken(profile.totp_secret, token)) {
            return NextResponse.json({ error: 'Invalid verification code.' }, { status: 400 });
        }

        await profiles.updateOne(
            { _id: userId },
            {
                $set: { totp_enabled: false, totp_secret: null, totp_recovery_codes: null, updated_at: new Date() },
            }
        );

        log.info('2FA disabled', { userId });
        await auditLog(userId, 'UPDATE_SETTINGS', 'settings', userId, { action: '2fa_disabled' }, request);

        const res = NextResponse.json({ success: true, message: '2FA has been disabled.' });
        res.cookies.delete(getTwoFactorCookieName());
        return res;
    } catch (error) {
        log.error('2FA disable failed', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
