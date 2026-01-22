/**
 * Security Logger
 * 
 * Centralized security event logging for audit and monitoring.
 * Logs to console in development, can be extended to external services.
 */

import { getAdminSupabase } from '@/lib/supabase/admin';

// Security event types
export type SecurityEventType =
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'LOGIN_BLOCKED'
    | 'LOGOUT'
    | 'REGISTER'
    | 'PASSWORD_RESET_REQUEST'
    | 'PASSWORD_RESET_SUCCESS'
    | 'EMAIL_VERIFIED'
    | 'ADMIN_ACCESS'
    | 'ADMIN_ACTION'
    | 'API_RATE_LIMITED'
    | 'SUSPICIOUS_ACTIVITY'
    | 'FILE_UPLOAD'
    | 'FILE_REJECTED'
    | 'PERMISSION_DENIED'
    | 'SESSION_EXPIRED';

interface SecurityLogEntry {
    eventType: SecurityEventType;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

/**
 * Get IP address from request
 */
export function getIpFromRequest(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    return forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
}

/**
 * Get user agent from request
 */
export function getUserAgentFromRequest(request: Request): string {
    return request.headers.get('user-agent') || 'unknown';
}

/**
 * Log security event to database
 * In production, this logs to Supabase security_logs table
 * Falls back to console in development or if DB unavailable
 */
export async function logSecurityEvent(entry: SecurityLogEntry): Promise<void> {
    const timestamp = new Date().toISOString();

    // Always log to console in development
    if (process.env.NODE_ENV === 'development') {
        const emoji = entry.severity === 'CRITICAL' ? '🚨' :
            entry.severity === 'WARNING' ? '⚠️' : 'ℹ️';
        console.log(`${emoji} [SECURITY] ${timestamp} ${entry.eventType}`, {
            userId: entry.userId || 'anonymous',
            ip: entry.ipAddress || 'unknown',
            ...entry.details
        });
    }

    // In production, log to database
    if (process.env.NODE_ENV === 'production') {
        try {
            const supabase = getAdminSupabase();
            await supabase.from('security_logs').insert({
                event_type: entry.eventType,
                user_id: entry.userId || null,
                ip_address: entry.ipAddress || null,
                user_agent: entry.userAgent || null,
                details: entry.details || {},
                severity: entry.severity,
                created_at: timestamp,
            });
        } catch (error) {
            // Fallback to console if DB fails
            console.error('[SECURITY LOG DB ERROR]', error);
            console.log(`[SECURITY FALLBACK] ${timestamp}`, entry);
        }
    }
}

// Convenience methods for common events

export const securityLog = {
    /**
     * Log successful login
     */
    loginSuccess: (userId: string, request: Request, email?: string) => {
        logSecurityEvent({
            eventType: 'LOGIN_SUCCESS',
            userId,
            ipAddress: getIpFromRequest(request),
            userAgent: getUserAgentFromRequest(request),
            details: { email: email ? `${email.slice(0, 3)}***` : undefined },
            severity: 'INFO',
        });
    },

    /**
     * Log failed login attempt
     */
    loginFailed: (request: Request, reason: string, email?: string) => {
        logSecurityEvent({
            eventType: 'LOGIN_FAILED',
            ipAddress: getIpFromRequest(request),
            userAgent: getUserAgentFromRequest(request),
            details: {
                reason,
                email: email ? `${email.slice(0, 3)}***` : undefined
            },
            severity: 'WARNING',
        });
    },

    /**
     * Log blocked login (rate limited or suspicious)
     */
    loginBlocked: (request: Request, reason: string) => {
        logSecurityEvent({
            eventType: 'LOGIN_BLOCKED',
            ipAddress: getIpFromRequest(request),
            userAgent: getUserAgentFromRequest(request),
            details: { reason },
            severity: 'CRITICAL',
        });
    },

    /**
     * Log admin action
     */
    adminAction: (userId: string, action: string, target: string, request: Request) => {
        logSecurityEvent({
            eventType: 'ADMIN_ACTION',
            userId,
            ipAddress: getIpFromRequest(request),
            userAgent: getUserAgentFromRequest(request),
            details: { action, target },
            severity: 'INFO',
        });
    },

    /**
     * Log rate limit hit
     */
    rateLimited: (request: Request, endpoint: string) => {
        logSecurityEvent({
            eventType: 'API_RATE_LIMITED',
            ipAddress: getIpFromRequest(request),
            userAgent: getUserAgentFromRequest(request),
            details: { endpoint },
            severity: 'WARNING',
        });
    },

    /**
     * Log suspicious activity
     */
    suspicious: (request: Request, reason: string, details?: Record<string, unknown>) => {
        logSecurityEvent({
            eventType: 'SUSPICIOUS_ACTIVITY',
            ipAddress: getIpFromRequest(request),
            userAgent: getUserAgentFromRequest(request),
            details: { reason, ...details },
            severity: 'CRITICAL',
        });
    },

    /**
     * Log file upload
     */
    fileUpload: (userId: string | undefined, filename: string, request: Request) => {
        logSecurityEvent({
            eventType: 'FILE_UPLOAD',
            userId,
            ipAddress: getIpFromRequest(request),
            userAgent: getUserAgentFromRequest(request),
            details: { filename },
            severity: 'INFO',
        });
    },

    /**
     * Log rejected file
     */
    fileRejected: (request: Request, filename: string, reason: string) => {
        logSecurityEvent({
            eventType: 'FILE_REJECTED',
            ipAddress: getIpFromRequest(request),
            userAgent: getUserAgentFromRequest(request),
            details: { filename, reason },
            severity: 'WARNING',
        });
    },

    /**
     * Log permission denied
     */
    permissionDenied: (userId: string | undefined, resource: string, request: Request) => {
        logSecurityEvent({
            eventType: 'PERMISSION_DENIED',
            userId,
            ipAddress: getIpFromRequest(request),
            userAgent: getUserAgentFromRequest(request),
            details: { resource },
            severity: 'WARNING',
        });
    },
};
