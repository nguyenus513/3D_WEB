/**
 * Sentry Client Configuration
 *
 * Initializes Sentry on the browser side for error tracking.
 * This file is auto-loaded by @sentry/nextjs.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session replay for debugging
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Only enable in production
    enabled: process.env.NODE_ENV === 'production',

    // Environment
    environment: process.env.NODE_ENV,

    // Filter out noisy errors
    ignoreErrors: [
        // Browser extensions
        'ResizeObserver loop',
        'Non-Error exception captured',
        // Network errors
        'Failed to fetch',
        'Load failed',
        'NetworkError',
        // User navigating away
        'AbortError',
    ],

    integrations: [
        Sentry.replayIntegration(),
    ],
});
