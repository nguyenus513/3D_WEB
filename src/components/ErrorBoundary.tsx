'use client';

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree.
 * Displays fallback UI instead of crashing the whole app.
 *
 * @see https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Custom fallback UI component */
    fallback?: ReactNode;
    /** Called when an error is caught */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    /** Display name for error context */
    name?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log to console in development
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Report to Sentry
        this.reportToSentry(error, errorInfo);

        // Call custom error handler
        this.props.onError?.(error, errorInfo);
    }

    private async reportToSentry(error: Error, errorInfo: ErrorInfo): Promise<void> {
        try {
            const Sentry = await import('@sentry/nextjs');
            Sentry.captureException(error, {
                extra: {
                    componentStack: errorInfo.componentStack,
                    boundaryName: this.props.name || 'Unknown',
                },
            });
        } catch {
            // Sentry not available
        }
    }

    private handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
                    <div className="mb-4 text-6xl">😢</div>
                    <h2 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-200">
                        Đã xảy ra lỗi
                    </h2>
                    <p className="mb-4 max-w-md text-gray-600 dark:text-gray-400">
                        Rất tiếc, đã có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ hỗ trợ nếu lỗi vẫn tiếp tục.
                    </p>
                    <button
                        onClick={this.handleRetry}
                        className="rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700"
                    >
                        Thử lại
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

// =============================================================================
// Error Fallback Components
// =============================================================================

interface ErrorFallbackProps {
    title?: string;
    message?: string;
    showRetry?: boolean;
    onRetry?: () => void;
}

/**
 * Minimal error fallback for small components
 */
export function ErrorFallbackMinimal({
    title = 'Lỗi',
    message = 'Không thể tải nội dung',
    showRetry = true,
    onRetry,
}: ErrorFallbackProps): ReactNode {
    return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">{title}</p>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{message}</p>
            {showRetry && onRetry && (
                <button
                    onClick={onRetry}
                    className="mt-2 text-xs text-red-700 underline hover:text-red-900 dark:text-red-300"
                >
                    Thử lại
                </button>
            )}
        </div>
    );
}

/**
 * Full page error fallback
 */
export function ErrorFallbackFullPage({
    title = 'Đã xảy ra lỗi',
    message = 'Rất tiếc, đã có lỗi không mong muốn xảy ra.',
    showRetry = true,
    onRetry,
}: ErrorFallbackProps): ReactNode {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8 dark:bg-gray-900">
            <div className="text-center">
                <div className="mb-6 text-8xl">🔧</div>
                <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
                <p className="mb-8 max-w-md text-gray-600 dark:text-gray-400">{message}</p>
                <div className="flex gap-4">
                    {showRetry && (
                        <button
                            onClick={onRetry || (() => window.location.reload())}
                            className="rounded-lg bg-blue-600 px-8 py-3 font-medium text-white transition-colors hover:bg-blue-700"
                        >
                            Tải lại trang
                        </button>
                    )}
                    <a
                        href="/"
                        className="rounded-lg border border-gray-300 bg-white px-8 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    >
                        Về trang chủ
                    </a>
                </div>
            </div>
        </div>
    );
}

export default ErrorBoundary;
