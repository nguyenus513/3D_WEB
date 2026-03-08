'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import TwoFactorSetup from '@/components/admin/TwoFactorSetup';

function SettingsContent() {
    const searchParams = useSearchParams();

    // Drive state
    const [driveConnected, setDriveConnected] = useState(false);
    const [isServiceAccount, setIsServiceAccount] = useState(false);
    const [driveLoading, setDriveLoading] = useState(true);
    const [driveMessage, setDriveMessage] = useState('');

    // 2FA state
    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
    const [twoFALoading, setTwoFALoading] = useState(true);

    useEffect(() => {
        const checkDriveStatus = async () => {
            try {
                const res = await fetch('/api/drive/status');
                const data = await res.json();
                setDriveConnected(data.connected);
                if (data.connected && data.type === 'service_account') {
                    setIsServiceAccount(true);
                } else if (data.connected) {
                    setDriveMessage('✅ Đã kết nối qua OAuth Token');
                }
            } catch (error) {
                console.error('Failed to check drive status:', error);
            } finally {
                setDriveLoading(false);
            }
        };

        checkDriveStatus();

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

        const connected = searchParams.get('drive_connected');
        const error = searchParams.get('drive_error');

        if (connected === 'true') {
            setDriveMessage('✅ Kết nối Google Drive thành công!');
            setDriveConnected(true);
        } else if (error) {
            setDriveMessage('❌ Lỗi: ' + decodeURIComponent(error));
        }
    }, [searchParams]);

    const connectDrive = () => {
        window.location.href = '/api/drive/auth';
    };

    const disconnectDrive = async () => {
        if (!confirm('Bạn có chắc muốn ngắt kết nối Google Drive?')) return;
        try {
            await fetch('/api/drive/status', { method: 'DELETE' });
            setDriveConnected(false);
            setDriveMessage('Đã ngắt kết nối Google Drive');
        } catch (error) {
            setDriveMessage('❌ Lỗi khi ngắt kết nối');
        }
    };

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
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Lưu trữ file</h2>
                        <p className="text-[var(--text-secondary)] text-sm mt-1">
                            Kết nối tài khoản Google để lưu ảnh và file 3D
                        </p>
                    </div>

                    {driveLoading ? (
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : driveConnected ? (
                        <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm">
                            {isServiceAccount ? 'Service Account' : 'Đã kết nối'}
                        </span>
                    ) : (
                        <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm">
                            Chưa kết nối
                        </span>
                    )}
                </div>

                {driveMessage && (
                    <div className={`mt-4 p-3 rounded-xl text-sm ${driveMessage.includes('✅')
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                        }`}>
                        {driveMessage}
                    </div>
                )}

                <div className="mt-6 pt-4 border-t border-[var(--border-color)]">
                    {isServiceAccount && (
                        <div className="mb-4 p-3 bg-yellow-500/10 text-yellow-400 text-sm rounded-xl">
                            ⚠️ <strong>Lưu ý:</strong> Service Account không có dung lượng lưu trữ (0 GB).
                            Nếu bạn dùng Gmail cá nhân, vui lòng kết nối tài khoản Google để dùng 15GB miễn phí.
                        </div>
                    )}

                    {driveConnected && !isServiceAccount ? (
                        <button
                            onClick={disconnectDrive}
                            className="px-4 py-2 rounded-xl border border-white/20 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-white/40 text-sm transition-colors"
                        >
                            Ngắt kết nối
                        </button>
                    ) : (
                        <button
                            onClick={connectDrive}
                            className="px-6 py-2.5 rounded-xl bg-white text-black font-medium hover:bg-[var(--material-glass)] text-sm transition-colors"
                        >
                            {isServiceAccount ? 'Chuyển sang kết nối tài khoản Google (OAuth)' : 'Kết nối tài khoản Google'}
                        </button>
                    )}
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
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        }>
            <SettingsContent />
        </Suspense>
    );
}
