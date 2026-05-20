/**
 * Security Logger Service
 *
 * Centralized logging for security-related events.
 * Writes to MongoDB `security_logs` table.
 *
 * @see DEVELOPMENT_GUIDE.md - Security Layer
 */

import { getAdminSupabase } from '@/lib/supabase/admin';

// =============================================================================
// Types
// =============================================================================

export type SecurityEventType =
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILURE'
    | 'REGISTER_SUCCESS'
    | 'REGISTER_FAILURE'
    | 'PASSWORD_RESET_REQUEST'
    | 'PASSWORD_RESET_SUCCESS'
    | 'ADMIN_ACTION'
    | 'UNAUTHORIZED_ACCESS'
    | 'RATE_LIMIT_EXCEEDED'
    | 'SUSPICIOUS_ACTIVITY';

export type SecuritySeverity = 'INFO' | 'WARNING' | 'CRITICAL';

interface SecurityLogEntry {
    event_type: SecurityEventType;
    details?: Record<string, unknown>;
    severity: SecuritySeverity;
    ip_address?: string | null;
    user_agent?: string | null;
    user_id?: string | null;
}

// =============================================================================
// MongoDB Admin Client (for logging)
// =============================================================================

const supabaseAdmin = getAdminSupabase();

// =============================================================================
// Security Logger Class
// =============================================================================

export class SecurityLogger {
    /**
     * Log a security event to the database
     */
    static async log(entry: SecurityLogEntry): Promise<void> {
        try {
            const { error } = await supabaseAdmin
                .from('security_logs')
                .insert({
                    event_type: entry.event_type,
                    details: entry.details || {},
                    severity: entry.severity,
                    ip_address: entry.ip_address,
                    user_agent: entry.user_agent,
                    user_id: entry.user_id,
                    created_at: new Date().toISOString(),
                });

            if (error) {
                console.error('[SecurityLogger] Failed to log:', error);
            }
        } catch (e) {
            console.error('[SecurityLogger] Exception:', e);
        }
    }

    // =========================================================================
    // Convenience Methods
    // =========================================================================

    static async logLogin(
        userId: string,
        success: boolean,
        ip?: string,
        userAgent?: string,
        details?: Record<string, unknown>
    ): Promise<void> {
        await this.log({
            event_type: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILURE',
            severity: success ? 'INFO' : 'WARNING',
            user_id: userId,
            ip_address: ip,
            user_agent: userAgent,
            details,
        });
    }

    static async logRegister(
        userId: string | null,
        success: boolean,
        ip?: string,
        details?: Record<string, unknown>
    ): Promise<void> {
        await this.log({
            event_type: success ? 'REGISTER_SUCCESS' : 'REGISTER_FAILURE',
            severity: success ? 'INFO' : 'WARNING',
            user_id: userId,
            ip_address: ip,
            details,
        });
    }

    static async logAdminAction(
        userId: string,
        action: string,
        targetId?: string,
        details?: Record<string, unknown>
    ): Promise<void> {
        await this.log({
            event_type: 'ADMIN_ACTION',
            severity: 'INFO',
            user_id: userId,
            details: { action, targetId, ...details },
        });
    }

    static async logUnauthorizedAccess(
        path: string,
        ip?: string,
        userId?: string
    ): Promise<void> {
        await this.log({
            event_type: 'UNAUTHORIZED_ACCESS',
            severity: 'WARNING',
            user_id: userId,
            ip_address: ip,
            details: { path },
        });
    }

    static async logRateLimitExceeded(
        endpoint: string,
        ip?: string,
        userId?: string
    ): Promise<void> {
        await this.log({
            event_type: 'RATE_LIMIT_EXCEEDED',
            severity: 'WARNING',
            user_id: userId,
            ip_address: ip,
            details: { endpoint },
        });
    }

    static async logSuspiciousActivity(
        description: string,
        ip?: string,
        userId?: string,
        details?: Record<string, unknown>
    ): Promise<void> {
        await this.log({
            event_type: 'SUSPICIOUS_ACTIVITY',
            severity: 'CRITICAL',
            user_id: userId,
            ip_address: ip,
            details: { description, ...details },
        });
    }
}

// =============================================================================
// Helper: Extract IP from Request
// =============================================================================

export function getClientIP(request: Request): string | null {
    // Try various headers (Vercel, Cloudflare, etc.)
    const headers = request.headers;
    return (
        headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headers.get('x-real-ip') ||
        headers.get('cf-connecting-ip') ||
        null
    );
}

export function getUserAgent(request: Request): string | null {
    return request.headers.get('user-agent');
}

