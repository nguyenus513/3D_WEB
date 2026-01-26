/**
 * Base Controller
 *
 * Abstract base class for all API controllers.
 * Provides standardized response handling and error tracking.
 *
 * @see backend-dev-guidelines.md - Rule #2: All Controllers Extend BaseController
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { config } from '@/config/unifiedConfig';

// =============================================================================
// Response Types (Envelope Pattern)
// =============================================================================

export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
    };
}

export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// =============================================================================
// Custom Error Classes
// =============================================================================

export class AppError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly statusCode: number = 500,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super('NOT_FOUND', message, 404);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super('UNAUTHORIZED', message, 401);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super('FORBIDDEN', message, 403);
    }
}

export class BadRequestError extends AppError {
    constructor(message = 'Bad request', details?: unknown) {
        super('BAD_REQUEST', message, 400, details);
    }
}

export class ValidationError extends AppError {
    constructor(message = 'Validation failed', details?: unknown) {
        super('VALIDATION_ERROR', message, 400, details);
    }
}

export class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super('CONFLICT', message, 409);
    }
}

export class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super('RATE_LIMIT_EXCEEDED', message, 429);
    }
}

// =============================================================================
// Sentry Integration (Lazy Load)
// =============================================================================

async function captureException(error: unknown, context?: Record<string, unknown>): Promise<void> {
    if (!config.sentry.isConfigured) {
        // Fallback to console in dev or if Sentry not configured
        console.error('[Error]', error, context);
        return;
    }

    try {
        // Dynamic import to avoid bundling Sentry if not configured
        const Sentry = await import('@sentry/nextjs').catch(() => null);
        if (Sentry) {
            Sentry.captureException(error, {
                extra: context,
            });
        } else {
            console.error('[Sentry not available]', error);
        }
    } catch {
        // If Sentry import fails, fallback to console
        console.error('[Sentry Error] Failed to capture:', error);
    }
}

// =============================================================================
// Base Controller
// =============================================================================

export abstract class BaseController {
    /**
     * Handle successful response with standardized format
     */
    protected handleSuccess<T>(
        data: T,
        options?: {
            status?: number;
            meta?: ApiSuccessResponse<T>['meta'];
            headers?: Record<string, string>;
        }
    ): NextResponse<ApiSuccessResponse<T>> {
        const response: ApiSuccessResponse<T> = {
            success: true,
            data,
        };

        if (options?.meta) {
            response.meta = options.meta;
        }

        return NextResponse.json(response, {
            status: options?.status ?? 200,
            headers: options?.headers,
        });
    }

    /**
     * Handle error response with standardized format and Sentry tracking
     */
    protected async handleError(
        error: unknown,
        context?: string
    ): Promise<NextResponse<ApiErrorResponse>> {
        // Log error with context
        const errorContext = {
            context,
            timestamp: new Date().toISOString(),
        };

        // Determine error type and response
        if (error instanceof AppError) {
            // Known application errors - log but don't spam Sentry with expected errors
            if (error.statusCode >= 500) {
                await captureException(error, errorContext);
            }

            return NextResponse.json(
                {
                    success: false as const,
                    error: {
                        code: error.code,
                        message: error.message,
                        details: config.isDevelopment ? error.details : undefined,
                    },
                },
                { status: error.statusCode }
            );
        }

        if (error instanceof z.ZodError) {
            // Validation errors - expected, don't send to Sentry
            const formattedErrors = error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
            }));

            return NextResponse.json(
                {
                    success: false as const,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Validation failed',
                        details: formattedErrors,
                    },
                },
                { status: 400 }
            );
        }

        // Unknown errors - always log to Sentry
        await captureException(error, errorContext);

        // Don't expose internal error details in production
        return NextResponse.json(
            {
                success: false as const,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: config.isProduction
                        ? 'An unexpected error occurred'
                        : error instanceof Error
                            ? error.message
                            : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }

    /**
     * Wrap async handler with error handling
     * Use this to wrap your controller methods
     */
    protected wrapHandler<T>(
        handler: () => Promise<NextResponse<ApiResponse<T>>>,
        context?: string
    ): Promise<NextResponse<ApiResponse<T>>> {
        return handler().catch((error) => this.handleError(error, context));
    }
}
