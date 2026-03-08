'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Application Error:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg-void)' }}>
            <div
                className="max-w-md w-full p-8 rounded-2xl text-center animate-scale-in"
                style={{
                    background: 'var(--material-overlay)',
                    backdropFilter: 'blur(var(--blur-overlay))',
                    WebkitBackdropFilter: 'blur(var(--blur-overlay))',
                    border: 'var(--border-spatial)',
                    boxShadow: 'var(--shadow-3)',
                }}
            >
                <div
                    className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(255, 69, 58, 0.12)' }}
                >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </div>

                <h2 className="text-2xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                    Đã xảy ra lỗi
                </h2>
                <p className="mb-2" style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
                    Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ hỗ trợ nếu vấn đề tiếp tục.
                </p>

                {error.digest && (
                    <p className="font-mono text-xs mb-6" style={{ color: 'var(--text-tertiary)' }}>
                        Mã lỗi: {error.digest}
                    </p>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                    <Button onClick={reset} variant="default" size="lg">
                        Thử lại
                    </Button>
                    <Button variant="outline" size="lg" asChild>
                        <a href="/">Về trang chủ</a>
                    </Button>
                </div>
            </div>
        </div>
    );
}
