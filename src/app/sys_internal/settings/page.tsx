'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import TwoFactorSetup from '@/components/admin/TwoFactorSetup';

function SettingsContent() {
    // 2FA state
    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
    const [twoFALoading, setTwoFALoading] = useState(true);

    useEffect(() => {
        // Check 2FA status
        const check2FAStatus = async () => {
            try {
                const res = await fetch('/api/admin/2fa/status');
                if (res.ok) {
                    const data = await res.json();
                    setTwoFAEnabled(data.enabled);
                }
            } catch {
                // Silently fail — 2FA section will show as disabled
            } finally {
                setTwoFALoading(false);
            }
        };
        check2FAStatus();

    }, []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Cài đặt</h1>
                <p className="text-[var(--text-secondary)] mt-1">Quản lý kết nối và lưu trữ file</p>
            </div>

            {/* Storage Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6"
            >
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Luu tru file</h2>
                        <p className="text-[var(--text-secondary)] text-sm mt-1">
                            He thong dang luu anh va file 3D bang Cloudflare R2.
                        </p>
                    </div>
                    <span className="px-3 py-1 rounded-full border border-white/20 text-white text-sm">
                        R2
                    </span>
                </div>
            </motion.div>

            {/* 2FA Security Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6"
            >
                {twoFALoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    </div>
                ) : (
                    <TwoFactorSetup
                        isEnabled={twoFAEnabled}
                        onStatusChange={(enabled) => setTwoFAEnabled(enabled)}
                    />
                )}
            </motion.div>
        </div>
    );
}

export default function AdminSettingsPage() {
    return <SettingsContent />;
}
