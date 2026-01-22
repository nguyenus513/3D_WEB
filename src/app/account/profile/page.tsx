'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { getSupabase } from '@/lib/supabase/client';

interface UserProfile {
    id: string;
    email: string;
    name: string | null;
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
        if (!session?.user?.email) return;

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, name, phone, customer_code')
            .eq('email', session.user.email)
            .single();

        if (!error && data) {
            setProfile(data);
            setFormData({
                name: data.name || '',
                phone: data.phone || '',
            });
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;

        setSaving(true);
        setMessage(null);

        const supabase = getSupabase();
        const { error } = await supabase
            .from('profiles')
            .update({
                name: formData.name,
                phone: formData.phone,
                updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id);

        if (error) {
            setMessage({ type: 'error', text: 'Không thể lưu thay đổi. Vui lòng thử lại.' });
        } else {
            setProfile({ ...profile, ...formData });
            setIsEditing(false);
            setMessage({ type: 'success', text: 'Đã lưu thay đổi thành công!' });
            setTimeout(() => setMessage(null), 3000);
        }
        setSaving(false);
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Hồ sơ cá nhân</h1>
                    <p className="text-white/50 mt-1">Quản lý thông tin tài khoản</p>
                </div>
                {!isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
                    >
                        Chỉnh sửa
                    </button>
                )}
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

            {/* Profile form */}
            <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSubmit}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-6"
            >
                {/* Avatar */}
                <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
                        {formData.name?.charAt(0) || session.user.email?.charAt(0) || '?'}
                    </div>
                    {profile?.customer_code && (
                        <div>
                            <p className="text-white/50 text-sm">Mã khách hàng</p>
                            <code className="text-white font-mono">{profile.customer_code}</code>
                        </div>
                    )}
                </div>

                {/* Name */}
                <div>
                    <label className="text-white/70 text-sm mb-2 block">Họ tên</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        disabled={!isEditing}
                        placeholder="Nhập họ tên"
                        className={`w-full px-4 py-3 rounded-xl border transition-all ${isEditing
                            ? 'bg-[#0a0a0a] border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/30'
                            : 'bg-transparent border-transparent text-white'
                            }`}
                    />
                </div>

                {/* Email */}
                <div>
                    <label className="text-white/70 text-sm mb-2 block">Email</label>
                    <input
                        type="email"
                        value={session.user.email || ''}
                        disabled
                        className="w-full px-4 py-3 rounded-xl bg-transparent text-white/50 cursor-not-allowed"
                    />
                    <p className="text-white/40 text-xs mt-1">Email không thể thay đổi</p>
                </div>

                {/* Phone */}
                <div>
                    <label className="text-white/70 text-sm mb-2 block">Số điện thoại</label>
                    <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        disabled={!isEditing}
                        placeholder="Nhập số điện thoại"
                        className={`w-full px-4 py-3 rounded-xl border transition-all ${isEditing
                            ? 'bg-[#0a0a0a] border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/30'
                            : 'bg-transparent border-transparent text-white'
                            }`}
                    />
                </div>

                {/* Actions */}
                {isEditing && (
                    <div className="flex gap-3 pt-4">
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
                                    name: profile?.name || '',
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
