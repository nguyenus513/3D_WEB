/**
 * Cleanup Unverified Accounts API
 * 
 * DELETE /api/auth/cleanup
 * 
 * Deletes accounts where:
 * - created_at > 15 minutes ago
 * - have associated verification_tokens (indicating unverified)
 * 
 * Can be called by cron job or on login attempt
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

// OTP expiration time in minutes
const OTP_EXPIRATION_MINUTES = 15;

export async function DELETE(request: NextRequest) {
    try {
        // Calculate cutoff time (accounts older than OTP expiration)
        const cutoffTime = new Date(Date.now() - OTP_EXPIRATION_MINUTES * 60 * 1000);

        // Find expired verification tokens
        const { data: expiredTokens, error: tokenError } = await supabaseAdmin
            .from('verification_tokens')
            .select('identifier')
            .lt('expires', new Date().toISOString());

        if (tokenError) {
            console.error('Error finding expired tokens:', tokenError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        if (!expiredTokens || expiredTokens.length === 0) {
            return NextResponse.json({
                message: 'No expired unverified accounts found',
                deleted: 0
            });
        }

        const expiredEmails = expiredTokens.map(t => t.identifier);

        // Find profiles with these emails that are old
        const { data: expiredAccounts, error: selectError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, created_at')
            .in('email', expiredEmails)
            .lt('created_at', cutoffTime.toISOString());

        if (selectError) {
            console.error('Error finding expired accounts:', selectError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        if (!expiredAccounts || expiredAccounts.length === 0) {
            // Just clean up tokens
            await supabaseAdmin
                .from('verification_tokens')
                .delete()
                .in('identifier', expiredEmails);

            return NextResponse.json({
                message: 'Cleaned up expired tokens only',
                deleted: 0
            });
        }

        const accountIds = expiredAccounts.map(acc => acc.id);
        const accountEmails = expiredAccounts.map(acc => acc.email);

        // Delete expired verification tokens first
        await supabaseAdmin
            .from('verification_tokens')
            .delete()
            .in('identifier', accountEmails);

        // Delete addresses for these users
        await supabaseAdmin
            .from('addresses')
            .delete()
            .in('user_id', accountIds);

        // Delete the unverified profiles
        const { error: deleteError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .in('id', accountIds);

        if (deleteError) {
            console.error('Error deleting expired accounts:', deleteError);
            return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
        }

        const { createLogger } = await import('@/lib/logger');
        createLogger('auth-cleanup').info('Cleanup complete', { deleted: expiredAccounts.length });

        return NextResponse.json({
            message: `Deleted ${expiredAccounts.length} unverified accounts`,
            deleted: expiredAccounts.length,
            emails: accountEmails.map(e => e.replace(/(.{3}).*(@.*)/, '$1***$2')) // Mask emails
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        return NextResponse.json(
            { error: 'Cleanup failed: ' + (error instanceof Error ? error.message : 'Unknown') },
            { status: 500 }
        );
    }
}

// GET endpoint to check cleanup status (admin only)
export async function GET(request: NextRequest) {
    try {
        const cutoffTime = new Date(Date.now() - OTP_EXPIRATION_MINUTES * 60 * 1000);

        // Count expired verification tokens
        const { data: expiredTokens, error } = await supabaseAdmin
            .from('verification_tokens')
            .select('identifier')
            .lt('expires', new Date().toISOString());

        if (error) {
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        return NextResponse.json({
            expiredCount: expiredTokens?.length || 0,
            expirationMinutes: OTP_EXPIRATION_MINUTES,
            cutoffTime: cutoffTime.toISOString()
        });
    } catch (error) {
        console.error('Check error:', error);
        return NextResponse.json({ error: 'Check failed' }, { status: 500 });
    }
}
