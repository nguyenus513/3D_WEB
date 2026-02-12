/**
 * Global Error Page
 *
 * Catches unhandled errors in the app and reports to Sentry.
 * Shows a user-friendly error message.
 */

'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html>
            <body>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    fontFamily: 'system-ui, sans-serif',
                    padding: '2rem',
                    textAlign: 'center',
                }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
                        Đã xảy ra lỗi
                    </h1>
                    <p style={{ color: '#666', marginBottom: '2rem' }}>
                        Chúng tôi đã ghi nhận sự cố và đang xử lý.
                    </p>
                    <button
                        onClick={reset}
                        style={{
                            padding: '0.75rem 2rem',
                            backgroundColor: '#000',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                        }}
                    >
                        Thử lại
                    </button>
                </div>
            </body>
        </html>
    );
}
