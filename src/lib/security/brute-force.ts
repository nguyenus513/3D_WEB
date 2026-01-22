/**
 * Brute Force Protection
 * 
 * Tracks failed login attempts and blocks repeated failures.
 */

import { getAdminSupabase } from '@/lib/supabase/admin';

interface FailedAttempt {
    id: string;
    email: string;
    ip_address: string;
    attempt_count: number;
    first_attempt_at: string;
    last_attempt_at: string;
    blocked_until: string | null;
}

// Configuration
const MAX_ATTEMPTS = 5; // Max failed attempts before block
const BLOCK_DURATION_MINUTES = 30; // How long to block
const ATTEMPT_WINDOW_MINUTES = 15; // Window to count attempts

/**
 * Check if login is blocked for this email/IP combination
 */
export async function isLoginBlocked(email: string, ipAddress: string): Promise<{
    blocked: boolean;
    blockedUntil?: Date;
    remainingAttempts?: number;
}> {
    const supabase = getAdminSupabase();

    const { data: attempt } = await supabase
        .from('failed_login_attempts')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('ip_address', ipAddress)
        .single();

    if (!attempt) {
        return { blocked: false, remainingAttempts: MAX_ATTEMPTS };
    }

    // Check if currently blocked
    if (attempt.blocked_until) {
        const blockedUntil = new Date(attempt.blocked_until);
        if (blockedUntil > new Date()) {
            return { blocked: true, blockedUntil };
        }

        // Block expired, reset attempts
        await supabase
            .from('failed_login_attempts')
            .delete()
            .eq('id', attempt.id);

        return { blocked: false, remainingAttempts: MAX_ATTEMPTS };
    }

    // Check if attempts are in the window
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - ATTEMPT_WINDOW_MINUTES);

    if (new Date(attempt.first_attempt_at) < windowStart) {
        // Old attempts, reset
        await supabase
            .from('failed_login_attempts')
            .delete()
            .eq('id', attempt.id);

        return { blocked: false, remainingAttempts: MAX_ATTEMPTS };
    }

    const remainingAttempts = Math.max(0, MAX_ATTEMPTS - attempt.attempt_count);
    return { blocked: remainingAttempts === 0, remainingAttempts };
}

/**
 * Record a failed login attempt
 */
export async function recordFailedAttempt(email: string, ipAddress: string): Promise<{
    blocked: boolean;
    blockedUntil?: Date;
    attemptCount: number;
}> {
    const supabase = getAdminSupabase();
    const normalizedEmail = email.toLowerCase();

    // Try to update existing record
    const { data: existing } = await supabase
        .from('failed_login_attempts')
        .select('*')
        .eq('email', normalizedEmail)
        .eq('ip_address', ipAddress)
        .single();

    if (existing) {
        const newCount = existing.attempt_count + 1;
        const shouldBlock = newCount >= MAX_ATTEMPTS;

        let blockedUntil: Date | null = null;
        if (shouldBlock) {
            blockedUntil = new Date();
            blockedUntil.setMinutes(blockedUntil.getMinutes() + BLOCK_DURATION_MINUTES);
        }

        await supabase
            .from('failed_login_attempts')
            .update({
                attempt_count: newCount,
                last_attempt_at: new Date().toISOString(),
                blocked_until: blockedUntil?.toISOString() || null,
            })
            .eq('id', existing.id);

        return {
            blocked: shouldBlock,
            blockedUntil: blockedUntil || undefined,
            attemptCount: newCount,
        };
    }

    // Create new record
    await supabase
        .from('failed_login_attempts')
        .insert({
            email: normalizedEmail,
            ip_address: ipAddress,
            attempt_count: 1,
        });

    return {
        blocked: false,
        attemptCount: 1,
    };
}

/**
 * Clear failed attempts on successful login
 */
export async function clearFailedAttempts(email: string, ipAddress: string): Promise<void> {
    const supabase = getAdminSupabase();

    await supabase
        .from('failed_login_attempts')
        .delete()
        .eq('email', email.toLowerCase())
        .eq('ip_address', ipAddress);
}

/**
 * Get all blocked IPs for an email (admin use)
 */
export async function getBlockedAttempts(email: string): Promise<FailedAttempt[]> {
    const supabase = getAdminSupabase();

    const { data } = await supabase
        .from('failed_login_attempts')
        .select('*')
        .eq('email', email.toLowerCase())
        .not('blocked_until', 'is', null)
        .gt('blocked_until', new Date().toISOString());

    return data || [];
}

/**
 * Unblock a specific IP for an email (admin use)
 */
export async function unblockIp(email: string, ipAddress: string): Promise<boolean> {
    const supabase = getAdminSupabase();

    const { error } = await supabase
        .from('failed_login_attempts')
        .delete()
        .eq('email', email.toLowerCase())
        .eq('ip_address', ipAddress);

    return !error;
}
