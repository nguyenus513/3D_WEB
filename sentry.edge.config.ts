/**
 * Sentry Edge Configuration
 *
 * Initializes Sentry for edge runtime (middleware, API routes with edge runtime).
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,

        // Lower sample rate for edge
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0.5,

        // Environment tag
        environment: process.env.NODE_ENV || 'development',
    });
}
