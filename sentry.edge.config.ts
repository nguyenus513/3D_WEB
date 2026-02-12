/**
 * Sentry Edge Configuration
 *
 * Initializes Sentry for Edge Runtime (middleware, edge routes).
 * This file is auto-loaded by @sentry/nextjs.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

    enabled: process.env.NODE_ENV === 'production',

    environment: process.env.NODE_ENV,
});
