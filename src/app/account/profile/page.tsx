'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export default function AccountProfilePage() {
    const [formData, setFormData] = useState({
        name: 'Nguyễn Văn A',
        email: 'nguyenvana@gmail.com',
        phone: '0901234567',
    });
    const [isEditing, setIsEditing] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Handle save
        setIsEditing(false);
    };

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
                        className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
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
                    <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                        <svg className="w-10 h-10 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    {isEditing && (
                        <button type="button" className="px-4 py-2 rounded-xl border border-white/20 text-white/70 hover:text-white transition-colors">
                            Đổi ảnh
                        </button>
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
                        value={formData.email}
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
                            className="px-6 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors"
                        >
                            Lưu thay đổi
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="px-6 py-3 rounded-xl border border-white/20 text-white/70 hover:text-white transition-colors"
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
                    <button className="px-4 py-2 rounded-xl border border-white/20 text-white/70 hover:text-white transition-colors">
                        Đổi mật khẩu
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
