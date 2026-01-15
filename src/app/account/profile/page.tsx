'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';

export default function AccountProfilePage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        phone: '',
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (!error && data) {
            setProfile(data);
            setFormData({
                full_name: data.full_name || '',
                phone: data.phone || '',
            });
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;

        setSaving(true);
        const supabase = getSupabase();

        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: formData.full_name,
                phone: formData.phone,
            })
            .eq('id', profile.id);

        if (!error) {
            setProfile({ ...profile, ...formData });
            setIsEditing(false);
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/50">Đang tải...</p>
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

            {/* Profile form */}
            <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSubmit}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-6"
            >
                {/* Avatar */}
                <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold text-white">
                        {formData.full_name?.charAt(0) || profile?.email?.charAt(0) || '?'}
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
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        disabled={!isEditing}
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
                        value={profile?.email || ''}
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
                                    full_name: profile?.full_name || '',
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

            {/* Password section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-semibold">Đổi mật khẩu</h3>
                        <p className="text-white/50 text-sm mt-1">Cập nhật mật khẩu tài khoản</p>
                    </div>
                    <button className="px-4 py-2 rounded-xl border border-white/20 text-white/70 hover:text-white">
                        Đổi mật khẩu
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
