/**
 * Production Logger
 *
 * Structured JSON logger for production use.
 * Replaces console.log in API routes with a consistent format.
 *
 * Features:
 * - JSON structured output
 * - Log levels with environment-based filtering
 * - Correlation ID support
 * - No sensitive data exposure (no error.stack in output)
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('Order created', { orderId: '123' });
 *   logger.error('Upload failed', error);
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
    level: LogLevel;
    message: string;
    service?: string;
    correlationId?: string;
    timestamp: string;
    [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

/** Minimum log level — suppress DEBUG in production */
const MIN_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG';

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LEVEL];
}

function formatError(err: unknown): Record<string, string> {
    if (err instanceof Error) {
        return {
            errorName: err.name,
            errorMessage: err.message,
            // Stack trace only in non-production (never exposed to clients)
            ...(process.env.NODE_ENV !== 'production' && { errorStack: err.stack || '' }),
        };
    }
    return { errorMessage: String(err) };
}

function emit(entry: LogEntry): void {
    const output = JSON.stringify(entry);
    switch (entry.level) {
        case 'ERROR':
            console.error(output);
            break;
        case 'WARN':
            console.warn(output);
            break;
        default:
            console.log(output);
    }
}

class Logger {
    private service: string;
    private correlationId?: string;

    constructor(service: string = 'app', correlationId?: string) {
        this.service = service;
        this.correlationId = correlationId;
    }

    /** Create a child logger with a specific service name */
    child(service: string, correlationId?: string): Logger {
        return new Logger(service, correlationId || this.correlationId);
    }

    debug(message: string, data?: Record<string, unknown>): void {
        if (!shouldLog('DEBUG')) return;
        emit({
            level: 'DEBUG',
            message,
            service: this.service,
            correlationId: this.correlationId,
            timestamp: new Date().toISOString(),
            ...data,
        });
    }

    info(message: string, data?: Record<string, unknown>): void {
        if (!shouldLog('INFO')) return;
        emit({
            level: 'INFO',
            message,
            service: this.service,
            correlationId: this.correlationId,
            timestamp: new Date().toISOString(),
            ...data,
        });
    }

    warn(message: string, data?: Record<string, unknown>): void {
        if (!shouldLog('WARN')) return;
        emit({
            level: 'WARN',
            message,
            service: this.service,
            correlationId: this.correlationId,
            timestamp: new Date().toISOString(),
            ...data,
        });
    }

    error(message: string, error?: unknown, data?: Record<string, unknown>): void {
        if (!shouldLog('ERROR')) return;
        emit({
            level: 'ERROR',
            message,
            service: this.service,
            correlationId: this.correlationId,
            timestamp: new Date().toISOString(),
            ...formatError(error),
            ...data,
        });
    }
}

/** Global logger instance */
export const logger = new Logger();

/** Create a service-specific logger */
export function createLogger(service: string, correlationId?: string): Logger {
    return new Logger(service, correlationId);
}

export { Logger };
