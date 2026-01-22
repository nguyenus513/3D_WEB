/**
 * Session Management Service
 * 
 * Handles user sessions, device tracking, and logout everywhere functionality.
 */

import { getAdminSupabase } from '@/lib/supabase/admin';
import crypto from 'crypto';

interface Session {
    id: string;
    user_id: string;
    session_token: string;
    device_fingerprint: string | null;
    ip_address: string | null;
    user_agent: string | null;
    device_name: string | null;
    is_active: boolean;
    last_active_at: string;
    expires_at: string;
    created_at: string;
}

interface CreateSessionParams {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
    expiresInDays?: number;
}

/**
 * Generate secure random token
 */
function generateToken(length = 64): string {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash token for storage
 */
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Parse user agent to get device name
 */
function parseDeviceName(userAgent: string | null): string {
    if (!userAgent) return 'Unknown Device';

    // Simple device detection
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('Android')) return 'Android Device';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Linux')) return 'Linux PC';

    return 'Unknown Device';
}

/**
 * Create a new session
 */
export async function createSession(params: CreateSessionParams): Promise<{
    session: Session;
    sessionToken: string;
    refreshToken: string;
}> {
    const supabase = getAdminSupabase();

    const sessionToken = generateToken(32);
    const refreshToken = generateToken(64);
    const familyId = crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (params.expiresInDays || 7));

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30); // Refresh token lasts 30 days

    // Create session
    const { data: session, error: sessionError } = await supabase
        .from('user_sessions')
        .insert({
            user_id: params.userId,
            session_token: hashToken(sessionToken),
            refresh_token: hashToken(refreshToken),
            device_fingerprint: params.deviceFingerprint || null,
            ip_address: params.ipAddress || null,
            user_agent: params.userAgent || null,
            device_name: parseDeviceName(params.userAgent || null),
            is_active: true,
            expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

    if (sessionError) {
        throw new Error(`Failed to create session: ${sessionError.message}`);
    }

    // Create refresh token record
    await supabase.from('refresh_tokens').insert({
        user_id: params.userId,
        token_hash: hashToken(refreshToken),
        session_id: session.id,
        family_id: familyId,
        expires_at: refreshExpiresAt.toISOString(),
    });

    return {
        session,
        sessionToken,
        refreshToken,
    };
}

/**
 * Validate session token
 */
export async function validateSession(sessionToken: string): Promise<Session | null> {
    const supabase = getAdminSupabase();
    const hashedToken = hashToken(sessionToken);

    const { data: session, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_token', hashedToken)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

    if (error || !session) {
        return null;
    }

    // Update last active
    await supabase
        .from('user_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', session.id);

    return session;
}

/**
 * Refresh session with token rotation
 */
export async function refreshSession(refreshToken: string): Promise<{
    newRefreshToken: string;
    session: Session;
} | null> {
    const supabase = getAdminSupabase();
    const hashedToken = hashToken(refreshToken);

    // Find and validate refresh token
    const { data: tokenRecord, error: tokenError } = await supabase
        .from('refresh_tokens')
        .select('*, user_sessions(*)')
        .eq('token_hash', hashedToken)
        .eq('is_revoked', false)
        .gt('expires_at', new Date().toISOString())
        .single();

    if (tokenError || !tokenRecord) {
        return null;
    }

    // Check for token reuse (potential theft)
    const { data: revokedInFamily } = await supabase
        .from('refresh_tokens')
        .select('id')
        .eq('family_id', tokenRecord.family_id)
        .eq('is_revoked', true)
        .limit(1);

    if (revokedInFamily && revokedInFamily.length > 0) {
        // Token family compromised - revoke all tokens in family
        await supabase
            .from('refresh_tokens')
            .update({
                is_revoked: true,
                revoked_at: new Date().toISOString(),
                revoked_reason: 'family_compromised'
            })
            .eq('family_id', tokenRecord.family_id);

        // Deactivate session
        await supabase
            .from('user_sessions')
            .update({ is_active: false })
            .eq('id', tokenRecord.session_id);

        return null;
    }

    // Revoke current token
    await supabase
        .from('refresh_tokens')
        .update({
            is_revoked: true,
            revoked_at: new Date().toISOString(),
            revoked_reason: 'rotated'
        })
        .eq('id', tokenRecord.id);

    // Generate new refresh token (same family)
    const newRefreshToken = generateToken(64);
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 30);

    await supabase.from('refresh_tokens').insert({
        user_id: tokenRecord.user_id,
        token_hash: hashToken(newRefreshToken),
        session_id: tokenRecord.session_id,
        family_id: tokenRecord.family_id,
        expires_at: newExpiresAt.toISOString(),
    });

    // Extend session expiry
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setDate(sessionExpiresAt.getDate() + 7);

    await supabase
        .from('user_sessions')
        .update({
            expires_at: sessionExpiresAt.toISOString(),
            last_active_at: new Date().toISOString()
        })
        .eq('id', tokenRecord.session_id);

    return {
        newRefreshToken,
        session: tokenRecord.user_sessions as Session,
    };
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const supabase = getAdminSupabase();

    const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId)
        .eq('user_id', userId);

    if (error) {
        return false;
    }

    // Revoke associated refresh tokens
    await supabase
        .from('refresh_tokens')
        .update({
            is_revoked: true,
            revoked_at: new Date().toISOString(),
            revoked_reason: 'session_revoked'
        })
        .eq('session_id', sessionId);

    return true;
}

/**
 * Revoke all sessions for a user (logout everywhere)
 */
export async function revokeAllSessions(userId: string): Promise<boolean> {
    const supabase = getAdminSupabase();

    const { error: sessionError } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

    if (sessionError) {
        return false;
    }

    await supabase
        .from('refresh_tokens')
        .update({
            is_revoked: true,
            revoked_at: new Date().toISOString(),
            revoked_reason: 'user_logout_all'
        })
        .eq('user_id', userId)
        .eq('is_revoked', false);

    return true;
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<Session[]> {
    const supabase = getAdminSupabase();

    const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('last_active_at', { ascending: false });

    if (error) {
        return [];
    }

    return data || [];
}
