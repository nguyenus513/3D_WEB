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
    getClientId
} from './api-rate-limit';

// File Validation
export {
    validateFileMagicBytes,
    detectFileType,
    validateUploadedFile,
    sanitizeFilename,
    validateSTLFile,
    STL_LIMITS,
    ALLOWED_MIME_TYPES
} from './file-validation';

// Security Logging (console)
export {
    securityLog,
    logSecurityEvent,
    getIpFromRequest,
    getUserAgentFromRequest
} from './logger';
export type { SecurityEventType } from './logger';

// Security Logging (database)
export { SecurityLogger, getClientIP, getUserAgent } from './SecurityLogger';

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

// CSRF Protection
export {
    generateCsrfToken,
    setCsrfCookie,
    getCsrfToken,
    validateCsrfToken,
    requireCsrf,
    getCsrfTokenForClient,
    CSRF_CONFIG,
} from './csrf';

// Redis Rate Limiting
export {
    checkRateLimit,
    resetRateLimit,
    isRedisConfigured,
    RATE_LIMITS,
} from './redis-rate-limit';
