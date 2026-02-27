'use client';

import { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { signIn, getCsrfToken } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Layers, Mail, Lock, EyeOff, Eye } from 'lucide-react';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/account';
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isMounted, setIsMounted] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        remember: false,
    });

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return null;

    // Initialize CSRF token on mount to prevent MissingCSRF error
    useEffect(() => {
        const initCsrf = async () => {
            await getCsrfToken();
        };
        initCsrf();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');



        try {
            // Ensure CSRF token is fresh before signIn
            const csrfToken = await getCsrfToken();


            if (!csrfToken) {
                setError('Lỗi bảo mật (CSRF). Vui lòng tải lại trang.');
                return;
            }


            const result = await signIn('credentials', {
                email: formData.email,
                password: formData.password,
                redirect: false,
            });



            if (result?.error) {
                // Map NextAuth errors to Vietnamese messages
                const errorMessages: Record<string, string> = {
                    'Email và mật khẩu là bắt buộc': 'Email và mật khẩu là bắt buộc',
                    'Email không tồn tại': 'Email không tồn tại',
                    'Mật khẩu không đúng': 'Mật khẩu không đúng',
                    'Email chưa được xác thực. Vui lòng kiểm tra hộp thư.': 'Email chưa được xác thực. Vui lòng kiểm tra hộp thư.',
                    'CredentialsSignin': 'Email hoặc mật khẩu không đúng',
                };

                setError(errorMessages[result.error] || 'Đăng nhập thất bại. Vui lòng thử lại.');
                return;
            }

            if (result?.ok) {
                console.log('[LOGIN DEBUG] SignIn successful, checking session...');

                // Fetch user session to check role - FORCE NO CACHE
                const sessionRes = await fetch('/api/auth/session', {
                    cache: 'no-store',
                    headers: {
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                    }
                });

                const session = await sessionRes.json();
                console.log('[LOGIN DEBUG] Session role:', session?.user?.role);

                // If user is admin, redirect to admin panel
                if (session?.user?.role === 'admin') {
                    console.log('[LOGIN DEBUG] Admin detected, redirecting to /sys_internal');
                    window.location.href = '/sys_internal';
                    return;
                }

                // Regular users go to callback URL or account page
                // Use window.location for hard redirect to ensure session is synced
                console.log('[LOGIN DEBUG] User detected, redirecting to:', callbackUrl);
                window.location.href = callbackUrl;
            }
        } catch {
            setError('Đã có lỗi xảy ra. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
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
                        <Layers size={32} className="text-black" strokeWidth={2} />
                    </Link>
                    <h1 className="text-3xl font-bold text-white mb-2">Đăng Nhập</h1>
                    <p className="text-white/50">Chào mừng bạn quay trở lại</p>
                </div>

                {/* Error Message */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm"
                        >
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Email */}
                    <div>
                        <label className="text-white/70 text-sm mb-2 block">Email</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                                <Mail size={20} strokeWidth={1.5} />
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

                    {/* Password */}
                    <div>
                        <label className="text-white/70 text-sm mb-2 block">Mật khẩu</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                                <Lock size={20} strokeWidth={1.5} />
                            </span>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full pl-12 pr-12 py-4 bg-[#1D1D1F] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 border border-white/10 transition-all"
                                required
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                            >
                                {showPassword ? (
                                    <EyeOff size={20} strokeWidth={1.5} />
                                ) : (
                                    <Eye size={20} strokeWidth={1.5} />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Remember & Forgot */}
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.remember}
                                onChange={(e) => setFormData({ ...formData, remember: e.target.checked })}
                                className="w-4 h-4 rounded border-white/20 bg-[#1D1D1F] text-white focus:ring-white/30"
                            />
                            <span className="text-white/60 text-sm">Ghi nhớ đăng nhập</span>
                        </label>
                        <Link href="/forgot-password" className="text-white/70 text-sm hover:underline">
                            Quên mật khẩu?
                        </Link>
                    </div>

                    {/* Submit */}
                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="w-full"
                        disabled={loading}
                    >
                        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    </Button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-4 my-8">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-white/40 text-sm">hoặc</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Google Login */}
                <button
                    onClick={() => signIn('google', { callbackUrl: '/api/auth/google-callback' })}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-all disabled:opacity-50"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Đăng nhập bằng Google
                </button>

                {/* Register Link */}
                <p className="text-center text-white/60 mt-8">
                    Chưa có tài khoản?{' '}
                    <Link href="/register" className="text-white font-medium hover:underline">
                        Đăng ký ngay
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}

// Wrap in Suspense for useSearchParams
export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
