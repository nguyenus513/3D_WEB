/**
 * 2FA Setup API
 *
 * POST /api/admin/2fa/setup
 * Generates TOTP secret and QR code for admin to scan.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { generateSecret, generateQRCodeDataURL } from '@/lib/security/totp';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('2fa-setup');

export async function POST(request: Request) {
    // skip2FA=true — 2FA setup is called before 2FA is active
    const { authorized, response, userId } = await requireAdmin(request, true);
    if (!authorized || !userId) return response;

    try {
        const supabase = getAdminSupabase();

        // Get admin email for TOTP label
        const { data: profile } = await supabase
            .from('users')
            .select('email, totp_enabled')
            .eq('id', userId)
            .single();

        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        if (profile.totp_enabled) {
            return NextResponse.json(
                { error: '2FA is already enabled. Disable it first to reconfigure.' },
                { status: 400 }
            );
        }

        // Generate secret
        const { secret, uri } = generateSecret(profile.email);

        // Generate QR code
        const qrCodeDataURL = await generateQRCodeDataURL(uri);

        // Store secret temporarily (not enabled yet — enable after verification)
        await supabase
            .from('users')
            .update({ totp_secret: secret })
            .eq('id', userId);

        log.info('2FA setup initiated', { userId });

        return NextResponse.json({
            qrCode: qrCodeDataURL,
            secret, // Show manual entry key
            uri,
        });
    } catch (error) {
        log.error('2FA setup failed', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
