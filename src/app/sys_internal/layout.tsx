'use client';

import { useState, useEffect } from 'react';
import { AdminSidebar, AdminHeader } from '@/components/admin';

/**
 * Global interceptor: detects 2FA-required 403 from admin APIs
 * and redirects to verify-2fa page automatically.
 * Self-heals if cookie expires mid-session.
 */
function useTwoFAInterceptor() {
    useEffect(() => {
        const originalFetch = window.fetch;

        window.fetch = async (...args) => {
            const response = await originalFetch(...args);

            // Only intercept 403 on admin API routes
            const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
            if (response.status === 403 && url.includes('/api/admin/')) {
                try {
                    const cloned = response.clone();
                    const data = await cloned.json();
                    if (data.requires2FA) {
                        window.location.href = '/admin/verify-2fa';
                        return response;
                    }
                } catch {
                    // Not JSON or parse error — ignore
                }
            }

            return response;
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, []);
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    useTwoFAInterceptor();

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
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
            <div className="lg:pl-64">
                <AdminHeader onMenuClick={() => setSidebarOpen(true)} />
                <main className="p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
