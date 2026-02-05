'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

interface SystemSetting {
    key: string;
    value: any;
    label?: string;
    description?: string;
}

interface PaymentConfig {
    id: string;
    order_type: string;
    bank_code: string;
    account_no: string;
    account_name: string;
    is_active: boolean;
    created_at: string;
}

function SettingsContent() {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Drive state
    const [driveConnected, setDriveConnected] = useState(false);
    const [isServiceAccount, setIsServiceAccount] = useState(false);
    const [driveLoading, setDriveLoading] = useState(true);
    const [driveMessage, setDriveMessage] = useState('');

    // DB state
    const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([]);
    const [paymentConfigs, setPaymentConfigs] = useState<PaymentConfig[]>([]);

    useEffect(() => {
        checkDriveStatus();
        fetchSettings();

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
            } else if (data.connected) {
                setDriveMessage('✅ Đã kết nối qua OAuth Token');
            }
        } catch (error) {
            console.error('Failed to check drive status:', error);
        } finally {
            setDriveLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/admin/settings');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSystemSettings(data.system || []);
            setPaymentConfigs(data.payment || []);
        } catch (err) {
            console.error('Failed to load settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSystem = async (key: string, value: string) => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'system_settings',
                    data: { key, value }
                })
            });
            if (!res.ok) throw new Error('Failed to save');
            fetchSettings();
        } catch (e) {
            console.error('Save error:', e);
        } finally {
            setSaving(false);
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
            key: 'general', label: 'Chung', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            )
        },
        {
            key: 'payment', label: 'Thanh toán', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
            )
        },
        {
            key: 'storage', label: 'Lưu trữ', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
            )
        },
    ];

    const orderTypeLabels: Record<string, string> = {
        'ready_made': 'Sản phẩm có sẵn',
        'custom': 'Đơn Custom',
        'printing': 'In 3D',
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Cài đặt</h1>
                <p className="text-white/50 mt-1">Quản lý cấu hình hệ thống và thanh toán</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
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

            {/* General Tab - System Settings */}
            {activeTab === 'general' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                >
                    <h2 className="text-lg font-semibold text-white mb-6">Cài đặt chung</h2>

                    {systemSettings.length === 0 ? (
                        <p className="text-white/50">Chưa có cài đặt nào trong bảng system_settings.</p>
                    ) : (
                        <div className="space-y-4">
                            {systemSettings.map((setting) => (
                                <div key={setting.key} className="p-4 bg-white/5 rounded-xl">
                                    <label className="block text-white font-medium mb-1">
                                        {setting.label || setting.key}
                                    </label>
                                    {setting.description && (
                                        <p className="text-white/50 text-sm mb-2">{setting.description}</p>
                                    )}
                                    <input
                                        type="text"
                                        defaultValue={typeof setting.value === 'object' ? JSON.stringify(setting.value) : setting.value}
                                        onBlur={(e) => handleUpdateSystem(setting.key, e.target.value)}
                                        className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white focus:border-white/40 focus:outline-none"
                                        disabled={saving}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}

            {/* Payment Tab - Payment Configs */}
            {activeTab === 'payment' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    <h2 className="text-lg font-semibold text-white">Cấu hình thanh toán</h2>

                    {paymentConfigs.length === 0 ? (
                        <div className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6">
                            <p className="text-white/50">Chưa có cấu hình thanh toán trong bảng payment_configs.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {paymentConfigs.map((config) => (
                                <div key={config.id} className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-bold text-white uppercase">
                                            {orderTypeLabels[config.order_type] || config.order_type}
                                        </h3>
                                        <span className={`px-2 py-1 text-xs rounded-full ${config.is_active
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-white/10 text-white/50'
                                            }`}>
                                            {config.is_active ? 'Đang hoạt động' : 'Tắt'}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-white/50 text-xs">Ngân hàng</label>
                                            <p className="text-white font-medium">{config.bank_code}</p>
                                        </div>
                                        <div>
                                            <label className="text-white/50 text-xs">Số tài khoản</label>
                                            <p className="text-cyan-400 font-mono">{config.account_no}</p>
                                        </div>
                                        <div>
                                            <label className="text-white/50 text-xs">Chủ tài khoản</label>
                                            <p className="text-white font-medium">{config.account_name}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}

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

                    {driveMessage && (
                        <div className={`mt-4 p-3 rounded-xl text-sm ${driveMessage.includes('✅')
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}>
                            {driveMessage}
                        </div>
                    )}

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
