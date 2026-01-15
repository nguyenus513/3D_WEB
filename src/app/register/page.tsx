'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { getSupabase } from '@/lib/supabase/client';

export default function RegisterPage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        address: '',
        agreeTerms: false,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.agreeTerms) {
            setError('Vui lòng đồng ý với điều khoản dịch vụ');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const supabase = getSupabase();

            // 1. Create auth user
            const { data, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.name,
                        phone: formData.phone,
                    }
                }
            });

            if (authError) {
                if (authError.message.includes('already registered')) {
                    setError('Email này đã được đăng ký');
                } else {
                    setError(authError.message);
                }
                return;
            }

            if (data.user) {
                // 2. Update profile with additional info
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: data.user.id,
                        email: formData.email,
                        full_name: formData.name,
                        phone: formData.phone,
                        role: 'customer',
                    });

                if (profileError) {
                    console.error('Profile update error:', profileError);
                }

                // Check if email confirmation is required
                if (data.session) {
                    // Auto-confirmed, redirect to account
                    router.push('/account');
                    router.refresh();
                } else {
                    // Need email confirmation
                    setSuccess(true);
                }
            }
        } catch {
            setError('Đã có lỗi xảy ra. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
        setLoading(true);
        setError('');

        try {
            const supabase = getSupabase();
            const { error: authError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                }
            });

            if (authError) {
                setError('Không thể đăng ký với Google. Vui lòng thử lại.');
            }
        } catch {
            setError('Đã có lỗi xảy ra. Vui lòng thử lại.');
            setLoading(false);
        }
    };

    // Success state - show confirmation message
    if (success) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6 py-20">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="w-full max-w-md text-center"
                >
                    <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-4">Đăng Ký Thành Công!</h1>
                    <p className="text-white/60 mb-8">
                        Chúng tôi đã gửi email xác nhận đến <strong className="text-white">{formData.email}</strong>.
                        Vui lòng kiểm tra hộp thư và click vào link xác nhận để hoàn tất đăng ký.
                    </p>
                    <Link href="/login">
                        <Button variant="primary" size="lg">
                            Đi đến trang đăng nhập
                        </Button>
                    </Link>
                </motion.div>
            </div>
        );
    }

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

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                        {error}
                    </div>
                )}

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
                                className="w-full pl-12 pr-4 py-4 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 border border-white/10 transition-all"
                                required
                                disabled={loading}
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
                                className="w-full pl-12 pr-4 py-4 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 border border-white/10 transition-all"
                                required
                                disabled={loading}
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
                                className="w-full pl-12 pr-4 py-4 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 border border-white/10 transition-all"
                                required
                                disabled={loading}
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
                                placeholder="Tối thiểu 6 ký tự"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full pl-12 pr-12 py-4 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 border border-white/10 transition-all"
                                required
                                minLength={6}
                                disabled={loading}
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

                    {/* Terms */}
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.agreeTerms}
                            onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                            className="w-4 h-4 mt-1 rounded border-white/20 bg-[#1D1D1F] text-white/70 focus:ring-white/30"
                            required
                        />
                        <span className="text-white/60 text-sm">
                            Tôi đồng ý với{' '}
                            <Link href="/terms" className="text-white/70 hover:underline">Điều khoản dịch vụ</Link>
                            {' '}và{' '}
                            <Link href="/privacy" className="text-white/70 hover:underline">Chính sách bảo mật</Link>
                        </span>
                    </label>

                    {/* Submit */}
                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="w-full"
                        disabled={loading}
                    >
                        {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
                    </Button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-4 my-8">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-white/40 text-sm">hoặc</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Google Signup */}
                <button
                    onClick={handleGoogleSignup}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white hover:bg-gray-100 text-black font-medium rounded-xl transition-all disabled:opacity-50"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Đăng ký với Google
                </button>

                {/* Login Link */}
                <p className="text-center text-white/60 mt-6">
                    Đã có tài khoản?{' '}
                    <Link href="/login" className="text-white/70 font-medium hover:underline">
                        Đăng nhập
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}

