/**
 * Brute Force Protection backed by MongoDB.
 */

import { randomUUID } from 'node:crypto';
import { getMongoCollections } from '@/lib/mongodb';
import type { FailedLoginAttemptDocument } from '@/lib/mongodb';

interface FailedAttempt {
    id: string;
    email: string;
    ip_address: string;
    attempt_count: number;
    first_attempt_at: string;
    last_attempt_at: string;
    blocked_until: string | null;
}

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MINUTES = 30;
const ATTEMPT_WINDOW_MINUTES = 15;

function toFailedAttempt(attempt: FailedLoginAttemptDocument): FailedAttempt {
    return {
        id: attempt._id,
        email: attempt.email,
        ip_address: attempt.ip_address,
        attempt_count: attempt.attempt_count || 0,
        first_attempt_at: (attempt.first_attempt_at || new Date()).toISOString(),
        last_attempt_at: (attempt.last_attempt_at || new Date()).toISOString(),
        blocked_until: attempt.blocked_until?.toISOString() || null,
    };
}

export async function isLoginBlocked(email: string, ipAddress: string): Promise<{
    blocked: boolean;
    blockedUntil?: Date;
    remainingAttempts?: number;
}> {
    const { failed_login_attempts } = await getMongoCollections();
    const normalizedEmail = email.toLowerCase();
    const attempt = await failed_login_attempts.findOne({ email: normalizedEmail, ip_address: ipAddress });

    if (!attempt) {
        return { blocked: false, remainingAttempts: MAX_ATTEMPTS };
    }

    if (attempt.blocked_until) {
        const blockedUntil = attempt.blocked_until;
        if (blockedUntil > new Date()) {
            return { blocked: true, blockedUntil };
        }

        await failed_login_attempts.deleteOne({ _id: attempt._id });
        return { blocked: false, remainingAttempts: MAX_ATTEMPTS };
    }

    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - ATTEMPT_WINDOW_MINUTES);

    if (attempt.first_attempt_at && attempt.first_attempt_at < windowStart) {
        await failed_login_attempts.deleteOne({ _id: attempt._id });
        return { blocked: false, remainingAttempts: MAX_ATTEMPTS };
    }

    const remainingAttempts = Math.max(0, MAX_ATTEMPTS - (attempt.attempt_count || 0));
    return { blocked: remainingAttempts === 0, remainingAttempts };
}

export async function recordFailedAttempt(email: string, ipAddress: string): Promise<{
    blocked: boolean;
    blockedUntil?: Date;
    attemptCount: number;
}> {
    const { failed_login_attempts } = await getMongoCollections();
    const normalizedEmail = email.toLowerCase();
    const now = new Date();
    const existing = await failed_login_attempts.findOne({ email: normalizedEmail, ip_address: ipAddress });

    if (existing) {
        const newCount = (existing.attempt_count || 0) + 1;
        const shouldBlock = newCount >= MAX_ATTEMPTS;
        const blockedUntil = shouldBlock
            ? new Date(now.getTime() + BLOCK_DURATION_MINUTES * 60 * 1000)
            : null;

        await failed_login_attempts.updateOne(
            { _id: existing._id },
            {
                $set: {
                    attempt_count: newCount,
                    last_attempt_at: now,
                    blocked_until: blockedUntil,
                },
            }
        );

        return {
            blocked: shouldBlock,
            blockedUntil: blockedUntil || undefined,
            attemptCount: newCount,
        };
    }

    await failed_login_attempts.insertOne({
        _id: randomUUID(),
        email: normalizedEmail,
        ip_address: ipAddress,
        attempt_count: 1,
        first_attempt_at: now,
        last_attempt_at: now,
        created_at: now,
    });

    return { blocked: false, attemptCount: 1 };
}

export async function clearFailedAttempts(email: string, ipAddress: string): Promise<void> {
    const { failed_login_attempts } = await getMongoCollections();
    await failed_login_attempts.deleteMany({ email: email.toLowerCase(), ip_address: ipAddress });
}

export async function getBlockedAttempts(email: string): Promise<FailedAttempt[]> {
    const { failed_login_attempts } = await getMongoCollections();
    const attempts = await failed_login_attempts
        .find({
            email: email.toLowerCase(),
            blocked_until: { $gt: new Date() },
        })
        .sort({ blocked_until: -1 })
        .toArray();

    return attempts.map(toFailedAttempt);
}

export async function unblockIp(email: string, ipAddress: string): Promise<boolean> {
    const { failed_login_attempts } = await getMongoCollections();
    const result = await failed_login_attempts.deleteMany({ email: email.toLowerCase(), ip_address: ipAddress });
    return result.acknowledged;
}
