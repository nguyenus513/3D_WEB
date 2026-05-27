import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { generateSecret, generateQRCodeDataURL } from '@/lib/security/totp';
import { getMongoCollections } from '@/lib/mongodb';
import { createLogger } from '@/lib/logger';

const log = createLogger('2fa-setup');

export async function POST(request: Request) {
    const { authorized, response, userId } = await requireAdmin(request, true);
    if (!authorized || !userId) return response;

    try {
        const { profiles } = await getMongoCollections();
        const profile = await profiles.findOne({ _id: userId });

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        if (profile.totp_enabled) {
            return NextResponse.json({ error: '2FA is already enabled. Disable it first to reconfigure.' }, { status: 400 });
        }

        const { secret, uri } = generateSecret(profile.email || userId);
        const qrCode = await generateQRCodeDataURL(uri);

        await profiles.updateOne(
            { _id: userId },
            { $set: { totp_secret: secret, updated_at: new Date() } }
        );

        log.info('2FA setup initiated', { userId });
        return NextResponse.json({ qrCode, secret, uri });
    } catch (error) {
        log.error('2FA setup failed', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
