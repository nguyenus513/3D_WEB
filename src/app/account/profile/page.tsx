'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';

interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    customer_code: string | null;
}

export default function AccountProfilePage() {
    const { data: session, status } = useSession();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
    });

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.email) {
            fetchProfile();
        } else if (status === 'unauthenticated') {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, session]);

    const fetchProfile = async () => {
        try {
            const response = await fetch('/api/profile');
            if (response.ok) {
                const data = await response.json();
                setProfile(data);
                setFormData({
                    name: data.full_name || '',
                    phone: data.phone || '',
                });
            } else {
                console.error('Failed to fetch profile:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;

        setSaving(true);
        setMessage(null);

        try {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: formData.name,
                    phone: formData.phone,
                }),
            });

            if (response.ok) {
                const updatedProfile = await response.json();
                setProfile(updatedProfile);
                setFormData({
                    name: updatedProfile.full_name || '',
                    phone: updatedProfile.phone || '',
                });
                setIsEditing(false);
                setMessage({ type: 'success', text: 'Đã lưu thay đổi thành công!' });
                setTimeout(() => setMessage(null), 3000);
            } else {
                const errorData = await response.json();
                setMessage({ type: 'error', text: errorData.error || 'Không thể lưu thay đổi. Vui lòng thử lại.' });
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            setMessage({ type: 'error', text: 'Đã xảy ra lỗi. Vui lòng thử lại sau.' });
        } finally {
            setSaving(false);
        }
    };

    if (status === 'loading' || loading) {
        return (
            <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/50">Đang tải...</p>
            </div>
        );
    }

    if (!session?.user) {
        return (
            <div className="p-12 text-center">
                <p className="text-white/50">Vui lòng đăng nhập để xem hồ sơ</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Hồ sơ cá nhân</h1>
                <p className="text-white/50 mt-1">Quản lý thông tin tài khoản</p>
            </div>

            {/* Message */}
            {message && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-xl ${message.type === 'success'
                        ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                        : 'bg-red-500/10 border border-red-500/30 text-red-400'
                        }`}
                >
                    {message.text}
                </motion.div>
            )}

            {/* Account Info Card - Read Only */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
            >
                <h2 className="text-lg font-semibold text-white mb-4">Thông tin tài khoản</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Customer code */}
                    {profile?.customer_code && (
                        <div>
                            <p className="text-white/50 text-sm mb-1">Mã khách hàng</p>
                            <code className="text-white font-mono text-lg">{profile.customer_code}</code>
                        </div>
                    )}
                    {/* Email */}
                    <div>
                        <p className="text-white/50 text-sm mb-1">Email</p>
                        <p className="text-white">{session.user.email}</p>
                        <p className="text-white/40 text-xs mt-1">Email không thể thay đổi</p>
                    </div>
                </div>
            </motion.div>

            {/* Personal Info Card - Editable */}
            <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onSubmit={handleSubmit}
                className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Thông tin cá nhân</h2>
                    {!isEditing && (
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 text-sm"
                        >
                            Chỉnh sửa
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Name */}
                    <div>
                        <label className="text-white/50 text-sm mb-2 block">Họ tên</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            disabled={!isEditing}
                            placeholder="Nhập họ tên"
                            className={`w-full px-4 py-3 rounded-xl border transition-all ${isEditing
                                ? 'bg-[#0a0a0a] border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/30'
                                : 'bg-transparent border-white/10 text-white'
                                }`}
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="text-white/50 text-sm mb-2 block">Số điện thoại</label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            disabled={!isEditing}
                            placeholder="Nhập số điện thoại"
                            className={`w-full px-4 py-3 rounded-xl border transition-all ${isEditing
                                ? 'bg-[#0a0a0a] border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/30'
                                : 'bg-transparent border-white/10 text-white'
                                }`}
                        />
                    </div>
                </div>

                {/* Actions */}
                {isEditing && (
                    <div className="flex gap-3 pt-6">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 disabled:opacity-50"
                        >
                            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsEditing(false);
                                setFormData({
                                    name: profile?.full_name || '',
                                    phone: profile?.phone || '',
                                });
                            }}
                            className="px-6 py-3 rounded-xl border border-white/20 text-white/70 hover:text-white"
                        >
                            Hủy
                        </button>
                    </div>
                )}
            </motion.form>
        </div>
    );
}
