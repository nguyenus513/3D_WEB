'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminSidebar, AdminHeader } from '@/components/admin';

/**
 * 2FA Gate: checks status on mount, redirects to verify page if needed.
 * This is the PRIMARY enforcement for admin page routes.
 * Returns: { loading, passed }
 */
function useTwoFAGate() {
    const [loading, setLoading] = useState(true);
    const [passed, setPassed] = useState(false);

    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch('/api/admin/2fa/status');
                if (!res.ok) {
                    // If status API fails, allow access (fail open)
                    setPassed(true);
                    return;
                }
                const data = await res.json();

                if (data.enabled && !data.verified) {
                    // 2FA enabled but not verified → redirect
                    window.location.href = '/admin/verify-2fa';
                    return; // Don't set passed — page will navigate away
                }

                // Either 2FA disabled or already verified
                setPassed(true);
            } catch {
                // Network error — fail open
                setPassed(true);
            } finally {
                setLoading(false);
            }
        };
        check();
    }, []);

    return { loading, passed };
}

/**
 * Safety net interceptor: catches mid-session 2FA 403 from APIs.
 * If cookie expires while admin is working, this auto-redirects.
 */
function useTwoFAInterceptor() {
    const handleResponse = useCallback(async (response: Response, url: string) => {
        if (response.status === 403 && url.includes('/api/admin/')) {
            try {
                const cloned = response.clone();
                const data = await cloned.json();
                if (data.requires2FA) {
                    window.location.href = '/admin/verify-2fa';
                }
            } catch {
                // Not JSON — ignore
            }
        }
        return response;
    }, []);

    useEffect(() => {
        const originalFetch = window.fetch;

        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
            await handleResponse(response, url);
            return response;
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, [handleResponse]);
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { loading, passed } = useTwoFAGate();
    useTwoFAInterceptor();

    // Show loading while checking 2FA status
    if (loading || !passed) {
        return (
            <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                    <p className="text-[var(--text-tertiary)] text-sm">Đang xác thực...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-[var(--bg-void)] overflow-hidden">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <AdminSidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Main content */}
            <div className="lg:pl-64 h-full flex flex-col">
                <AdminHeader onMenuClick={() => setSidebarOpen(true)} />
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
