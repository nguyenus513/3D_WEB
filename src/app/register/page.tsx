'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

export default function RegisterPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        // Shipping Address
        recipientName: '',
        address: '',
        saveAsDefault: true,
        agreeTerms: false,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Handle register logic
        console.log('Register:', formData);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6 py-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-md"
            >
                {/* Logo */}
                <div className="text-center mb-10">
                    <Link href="/" className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white mb-6">
                        <svg className="w-8 h-8 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </Link>
                    <h1 className="text-3xl font-bold text-white mb-2">Tạo Tài Khoản</h1>
                    <p className="text-white/50">Bắt đầu với 3D Print ngay hôm nay</p>
                </div>

                {/* Register Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name */}
                    <div>
                        <label className="text-white/70 text-sm mb-2 block">Họ tên</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder="Nguyễn Văn A"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full pl-12 pr-4 py-4 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#0071E3] border border-white/10 transition-all"
                                required
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="text-white/70 text-sm mb-2 block">Email</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </span>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full pl-12 pr-4 py-4 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#0071E3] border border-white/10 transition-all"
                                required
                            />
                        </div>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="text-white/70 text-sm mb-2 block">Số điện thoại</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                            </span>
                            <input
                                type="tel"
                                placeholder="0912 345 678"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full pl-12 pr-4 py-4 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#0071E3] border border-white/10 transition-all"
                                required
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="text-white/70 text-sm mb-2 block">Mật khẩu</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </span>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Tối thiểu 8 ký tự"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full pl-12 pr-12 py-4 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#0071E3] border border-white/10 transition-all"
                                required
                                minLength={8}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                            >
                                {showPassword ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Shipping Address Section */}
                    <div className="border-t border-white/10 pt-5 mt-2">
                        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Địa chỉ giao hàng
                        </h3>

                        {/* Recipient Name */}
                        <div className="mb-4">
                            <label className="text-white/70 text-sm mb-2 block">Tên người nhận</label>
                            <input
                                type="text"
                                placeholder="Tên người nhận hàng"
                                value={formData.recipientName}
                                onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                                className="w-full px-4 py-4 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#0071E3] border border-white/10 transition-all"
                                required
                            />
                        </div>

                        {/* Address */}
                        <div className="mb-4">
                            <label className="text-white/70 text-sm mb-2 block">Địa chỉ</label>
                            <textarea
                                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className="w-full px-4 py-4 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#0071E3] border border-white/10 transition-all resize-none"
                                rows={2}
                                required
                            />
                        </div>

                        {/* Save as Default */}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.saveAsDefault}
                                onChange={(e) => setFormData({ ...formData, saveAsDefault: e.target.checked })}
                                className="w-4 h-4 rounded border-white/20 bg-[#1D1D1F] text-[#0071E3] focus:ring-[#0071E3]"
                            />
                            <span className="text-white/60 text-sm">Lưu làm địa chỉ mặc định</span>
                        </label>
                    </div>

                    {/* Terms */}
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.agreeTerms}
                            onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                            className="w-4 h-4 mt-1 rounded border-white/20 bg-[#1D1D1F] text-[#0071E3] focus:ring-[#0071E3]"
                            required
                        />
                        <span className="text-white/60 text-sm">
                            Tôi đồng ý với{' '}
                            <Link href="/terms" className="text-[#0071E3] hover:underline">Điều khoản dịch vụ</Link>
                            {' '}và{' '}
                            <Link href="/privacy" className="text-[#0071E3] hover:underline">Chính sách bảo mật</Link>
                        </span>
                    </label>

                    {/* Submit */}
                    <Button type="submit" variant="primary" size="lg" className="w-full">
                        Tạo tài khoản
                    </Button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-4 my-8">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-white/40 text-sm">hoặc</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Login Link */}
                <p className="text-center text-white/60">
                    Đã có tài khoản?{' '}
                    <Link href="/login" className="text-[#0071E3] font-medium hover:underline">
                        Đăng nhập
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
