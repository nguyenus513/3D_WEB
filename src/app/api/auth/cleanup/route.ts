/**
 * Cleanup Unverified Accounts API - MongoDB backed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getMongoCollection, getMongoCollections } from '@/lib/mongodb';

const OTP_EXPIRATION_MINUTES = 15;

async function isAuthorized(request: NextRequest): Promise<boolean> {
    const session = await auth();
    const cronSecret = request.headers.get('x-cron-secret');
    return (session?.user as { role?: string } | undefined)?.role === 'admin'
        || !!(cronSecret && cronSecret === process.env.ADMIN_SECRET_KEY);
}

function maskEmail(email: string): string {
    return email.replace(/(.{3}).*(@.*)/, '$1***$2');
}

export async function DELETE(request: NextRequest) {
    try {
        if (!(await isAuthorized(request))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const cutoffTime = new Date(Date.now() - OTP_EXPIRATION_MINUTES * 60 * 1000);
        const verificationTokens = await getMongoCollection<{ _id: string; identifier: string; expires: Date }>('verification_tokens');
        const { profiles, addresses } = await getMongoCollections();
        const expiredTokens = await verificationTokens
            .find({ expires: { $lt: new Date() } }, { projection: { identifier: 1 } })
            .toArray();

        if (expiredTokens.length === 0) {
            return NextResponse.json({ message: 'No expired unverified accounts found', deleted: 0 });
        }

        const expiredEmails = [...new Set(expiredTokens.map(token => token.identifier.toLowerCase()))];
        const expiredAccounts = await profiles
            .find({
                email: { $in: expiredEmails },
                email_verified: { $ne: true },
                created_at: { $lt: cutoffTime },
            }, { projection: { _id: 1, email: 1 } })
            .toArray();

        if (expiredAccounts.length === 0) {
            await verificationTokens.deleteMany({ identifier: { $in: expiredEmails } });
            return NextResponse.json({ message: 'Cleaned up expired tokens only', deleted: 0 });
        }

        const accountIds = expiredAccounts.map(account => account._id);
        const accountEmails = expiredAccounts
            .map(account => account.email)
            .filter((email): email is string => !!email);

        await verificationTokens.deleteMany({ identifier: { $in: accountEmails } });
        await addresses.deleteMany({ user_id: { $in: accountIds } });
        await profiles.deleteMany({ _id: { $in: accountIds } });

        const { createLogger } = await import('@/lib/logger');
        createLogger('auth-cleanup').info('Cleanup complete', { deleted: expiredAccounts.length });

        return NextResponse.json({
            message: `Deleted ${expiredAccounts.length} unverified accounts`,
            deleted: expiredAccounts.length,
            emails: accountEmails.map(maskEmail),
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        return NextResponse.json(
            { error: 'Cleanup failed: ' + (error instanceof Error ? error.message : 'Unknown') },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if ((session?.user as { role?: string } | undefined)?.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const cutoffTime = new Date(Date.now() - OTP_EXPIRATION_MINUTES * 60 * 1000);
        const verificationTokens = await getMongoCollection<{ _id: string; identifier: string; expires: Date }>('verification_tokens');
        const expiredCount = await verificationTokens.countDocuments({ expires: { $lt: new Date() } });

        return NextResponse.json({
            expiredCount,
            expirationMinutes: OTP_EXPIRATION_MINUTES,
            cutoffTime: cutoffTime.toISOString(),
        });
    } catch (error) {
        console.error('Check error:', error);
        return NextResponse.json({ error: 'Check failed' }, { status: 500 });
    }
}
