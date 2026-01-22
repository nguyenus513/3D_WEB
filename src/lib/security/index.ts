/**
 * Security Module
 * 
 * Exports all security utilities for easy import.
 * 
 * @example
 * import { sanitizeHtml, securityLog, isRateLimited } from '@/lib/security';
 */

// XSS Protection & Sanitization
export {
    sanitizeHtml,
    stripHtml,
    escapeHtml,
    sanitizeUrl,
    sanitizeObject
} from './sanitize';

// API Rate Limiting
export {
    isRateLimited,
    rateLimitedResponse,
    getRateLimitHeaders,
    getClientId,
    API_RATE_LIMITS
} from './api-rate-limit';

// File Validation
export {
    validateFileMagicBytes,
    detectFileType,
    validateUploadedFile,
    sanitizeFilename,
    ALLOWED_MIME_TYPES
} from './file-validation';

// Security Logging
export {
    securityLog,
    logSecurityEvent,
    getIpFromRequest,
    getUserAgentFromRequest
} from './logger';
export type { SecurityEventType } from './logger';

// Session Management
export {
    createSession,
    validateSession,
    refreshSession,
    revokeSession,
    revokeAllSessions,
    getUserSessions,
} from './session-manager';

// Brute Force Protection
export {
    isLoginBlocked,
    recordFailedAttempt,
    clearFailedAttempts,
    getBlockedAttempts,
    unblockIp,
} from './brute-force';

// Admin Auth Guard
export {
    requireAdmin,
    isAdmin,
} from './admin-guard';
