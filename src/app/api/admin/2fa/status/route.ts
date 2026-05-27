import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { getMongoCollections } from '@/lib/mongodb';
import { getTwoFactorCookieName, getTwoFactorSessionFingerprint, verifyTwoFactorCookie } from '@/lib/security/twofa-cookie';

export async function GET(request: NextRequest) {
    const { authorized, response, userId, session } = await requireAdmin(request, true);
    if (!authorized || !userId) return response;

    try {
        const { profiles } = await getMongoCollections();
        const profile = await profiles.findOne({ _id: userId });
        const enabled = Boolean(profile?.totp_enabled);

        let verified = false;
        if (enabled) {
            verified = await verifyTwoFactorCookie(request.cookies.get(getTwoFactorCookieName())?.value, {
                userId,
                email: session?.user?.email,
                sessionFingerprint: await getTwoFactorSessionFingerprint(request.cookies),
            });
        }

        return NextResponse.json({ enabled, verified });
    } catch (error) {
        console.error('[2FAStatus] Failed:', error);
        return NextResponse.json({ error: '2FA_STATUS_FAILED' }, { status: 500 });
    }
}
