'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

function SettingsContent() {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState('storage');
    const [driveConnected, setDriveConnected] = useState(false);
    const [isServiceAccount, setIsServiceAccount] = useState(false);
    const [driveLoading, setDriveLoading] = useState(true);
    const [driveMessage, setDriveMessage] = useState('');

    // Check Drive connection status on load
    useEffect(() => {
        checkDriveStatus();

        // Check URL params for OAuth result
        const connected = searchParams.get('drive_connected');
        const error = searchParams.get('drive_error');

        if (connected === 'true') {
            setDriveMessage('✅ Kết nối Google Drive thành công!');
            setDriveConnected(true);
        } else if (error) {
            setDriveMessage('❌ Lỗi: ' + decodeURIComponent(error));
        }
    }, [searchParams]);

    const checkDriveStatus = async () => {
        try {
            const res = await fetch('/api/drive/status');
            const data = await res.json();
            setDriveConnected(data.connected);

            if (data.connected && data.type === 'service_account') {
                setIsServiceAccount(true);
                setDriveMessage(''); // No message needed for Service Account
            } else if (data.connected) {
                setDriveMessage('✅ Đã kết nối qua OAuth Token');
            }
        } catch (error) {
            console.error('Failed to check drive status:', error);
        } finally {
            setDriveLoading(false);
        }
    };

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

    const tabs = [
        {
            key: 'storage', label: 'Lưu trữ', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
            )
        },
        {
            key: 'general', label: 'Cài đặt chung', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            )
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Cài đặt</h1>
                <p className="text-white/50 mt-1">Quản lý cấu hình và kết nối</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === tab.key
                            ? 'bg-white text-black'
                            : 'bg-[#1D1D1F] text-white/70 hover:text-white border border-white/10'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Storage Tab - Google Drive Connection */}
            {activeTab === 'storage' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-white">Lưu trữ file</h2>
                            <p className="text-white/50 text-sm mt-1">
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

                    {/* Message */}
                    {driveMessage && (
                        <div className={`mt-4 p-3 rounded-xl text-sm ${driveMessage.includes('✅') || driveMessage.includes('Service Account') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {driveMessage}
                        </div>
                    )}

                    {/* Action - Hide completely for Service Account */}
                    {!isServiceAccount && (
                        <div className="mt-6 pt-4 border-t border-white/10">
                            {driveConnected ? (
                                <button
                                    onClick={disconnectDrive}
                                    className="px-4 py-2 rounded-xl border border-white/20 text-white/70 hover:text-white hover:border-white/40 text-sm transition-colors"
                                >
                                    Ngắt kết nối
                                </button>
                            ) : (
                                <button
                                    onClick={connectDrive}
                                    className="px-6 py-2.5 rounded-xl bg-white text-black font-medium hover:bg-white/90 text-sm transition-colors"
                                >
                                    Kết nối tài khoản Google
                                </button>
                            )}
                        </div>
                    )}
                </motion.div>
            )}

            {/* General Tab */}
            {activeTab === 'general' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                >
                    <h2 className="text-lg font-semibold text-white mb-6">Cài đặt chung</h2>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                            <div>
                                <h3 className="text-white font-medium">Chế độ bảo trì</h3>
                                <p className="text-white/50 text-sm">Tạm ngừng website để bảo trì</p>
                            </div>
                            <button className="w-12 h-6 rounded-full bg-white/20 relative transition-colors">
                                <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform" />
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                            <div>
                                <h3 className="text-white font-medium">Nhận thông báo email</h3>
                                <p className="text-white/50 text-sm">Gửi email khi có đơn hàng mới</p>
                            </div>
                            <button className="w-12 h-6 rounded-full bg-white relative transition-colors">
                                <span className="absolute right-1 top-1 w-4 h-4 rounded-full bg-black transition-transform" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

// Wrapper with Suspense for useSearchParams
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
