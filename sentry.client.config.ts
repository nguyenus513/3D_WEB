/**
 * Sentry Client-Side Configuration
 *
 * Initializes Sentry for browser-side error tracking.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,

        // Adjust in production - lower for performance
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // Enable session replay for debugging (expensive, use sparingly)
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

        // Set to true for development debugging
        debug: false,

        // Environment tag
        environment: process.env.NODE_ENV || 'development',

        // App version
        release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || '1.0.0',

        // Don't send console logs to Sentry
        integrations: [
            Sentry.browserTracingIntegration(),
        ],

        // Filter out noise
        beforeSend(event) {
            // Filter out specific errors
            const message = event.exception?.values?.[0]?.value || '';

            // Don't send network errors from user's connection issues
            if (
                message.includes('Failed to fetch') ||
                message.includes('NetworkError') ||
                message.includes('Load failed')
            ) {
                return null;
            }

            return event;
        },

        // Block PII from being sent
        beforeBreadcrumb(breadcrumb) {
            // Remove sensitive headers
            if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') {
                if (breadcrumb.data?.headers) {
                    delete breadcrumb.data.headers.Authorization;
                    delete breadcrumb.data.headers.Cookie;
                }
            }
            return breadcrumb;
        },
    });
}
