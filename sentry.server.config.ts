/**
 * Sentry Server-Side Configuration
 *
 * Initializes Sentry for server-side error tracking.
 * This file must be imported FIRST in the app.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,

        // Adjust this value in production, or use tracesSampler for finer control
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // Set to true for development debugging
        debug: process.env.NODE_ENV === 'development',

        // Environment tag
        environment: process.env.NODE_ENV || 'development',

        // App version from package.json or git commit
        release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version,

        // Filter out non-critical errors
        beforeSend(event) {
            // Don't send events for expected errors
            if (event.exception?.values?.[0]?.type === 'NotFoundError') {
                return null;
            }
            return event;
        },
    });
}
