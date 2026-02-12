/**
 * Sentry Server Configuration
 *
 * Initializes Sentry on the server side for error tracking.
 * This file is auto-loaded by @sentry/nextjs.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Performance monitoring — lower sample rate on server
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

    // Only enable in production
    enabled: process.env.NODE_ENV === 'production',

    // Environment
    environment: process.env.NODE_ENV,

    // Tag all server errors
    initialScope: {
        tags: {
            runtime: 'server',
        },
    },
});
