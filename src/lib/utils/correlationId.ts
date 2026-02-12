/**
 * Correlation ID Utility
 * Generates and manages correlation IDs for request tracing
 */

/**
 * Generate a unique correlation ID for request tracing
 * Format: corr-{timestamp}-{random}
 */
export function generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `corr-${timestamp}-${random}`;
}

/**
 * Extract correlation ID from headers or generate new one
 */
export function getCorrelationId(headers: Headers): string {
    return headers.get('X-Correlation-ID') || generateCorrelationId();
}

/**
 * Logger with correlation ID support
 */
export class CorrelatedLogger {
    constructor(
        private service: string,
        private correlationId: string
    ) { }

    info(message: string, data?: Record<string, unknown>) {
        console.log(
            JSON.stringify({
                level: 'INFO',
                service: this.service,
                correlationId: this.correlationId,
                message,
                ...data,
                timestamp: new Date().toISOString(),
            })
        );
    }

    error(message: string, error?: unknown, data?: Record<string, unknown>) {
        console.error(
            JSON.stringify({
                level: 'ERROR',
                service: this.service,
                correlationId: this.correlationId,
                message,
                error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
                ...data,
                timestamp: new Date().toISOString(),
            })
        );
    }

    warn(message: string, data?: Record<string, unknown>) {
        console.warn(
            JSON.stringify({
                level: 'WARN',
                service: this.service,
                correlationId: this.correlationId,
                message,
                ...data,
                timestamp: new Date().toISOString(),
            })
        );
    }
}
