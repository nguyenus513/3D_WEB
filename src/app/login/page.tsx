'use client';

import { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { signIn, getCsrfToken, getProviders, useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from '@/components/ui/form';
import { Layers, Mail, Lock, Eye, EyeOff } from 'lucide-react';

const loginSchema = z.object({
    email: z.string().min(1, 'Email là bắt buộc').email('Email không hợp lệ'),
    password: z.string().min(1, 'Mật khẩu là bắt buộc'),
    remember: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function getSafeLocalPath(value: string | null | undefined, fallback = '/account') {
    if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
    if (value.startsWith('/login') || value.startsWith('/register')) return fallback;
    return value;
}

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const rawCallbackUrl = searchParams.get('callbackUrl') || searchParams.get('redirect');
    const [storedReturnTo, setStoredReturnTo] = useState('/account');
    const callbackUrl = getSafeLocalPath(rawCallbackUrl || storedReturnTo);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isMounted, setIsMounted] = useState(false);
    const [googleEnabled, setGoogleEnabled] = useState(false);
    const { data: activeSession, status: sessionStatus } = useSession();

    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
            remember: false,
        },
    });

    useEffect(() => {
        setIsMounted(true);
        const savedReturnTo = sessionStorage.getItem('miniver.returnTo');
        if (savedReturnTo) {
            setStoredReturnTo(getSafeLocalPath(savedReturnTo));
            return;
        }
        try {
            const referrer = document.referrer ? new URL(document.referrer) : null;
            if (referrer?.origin === window.location.origin) {
                setStoredReturnTo(getSafeLocalPath(`${referrer.pathname}${referrer.search}`));
            }
        } catch { }
    }, []);

    useEffect(() => {
        const initCsrf = async () => {
            await getCsrfToken();
        };
        initCsrf();
    }, []);

    useEffect(() => {
        const loadProviders = async () => {
            const providers = await getProviders();
            setGoogleEnabled(Boolean(providers?.google));
        };
        loadProviders().catch(() => setGoogleEnabled(false));
    }, []);

    useEffect(() => {
        if (!isMounted || sessionStatus !== 'authenticated') return;
        sessionStorage.removeItem('miniver.returnTo');
        const role = (activeSession?.user as { role?: string } | undefined)?.role;
        window.location.replace(role === 'admin' ? '/sys_internal' : callbackUrl);
    }, [isMounted, sessionStatus, activeSession, callbackUrl]);

    if (!isMounted) return null;

    const onSubmit = async (data: LoginFormValues) => {
        setLoading(true);
        setError('');

        try {
            const csrfToken = await getCsrfToken();

            if (!csrfToken) {
                setError('Lỗi bảo mật (CSRF). Vui lòng tải lại trang.');
                return;
            }

            const result = await signIn('credentials', {
                email: data.email,
                password: data.password,
                redirect: false,
            });

            if (result?.error) {
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
                const sessionRes = await fetch('/api/auth/session', {
                    cache: 'no-store',
                    headers: {
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                    }
                });

                const session = await sessionRes.json();

                if (session?.user?.role === 'admin') {
                    window.location.href = '/sys_internal';
                    return;
                }

                sessionStorage.removeItem('miniver.returnTo');
                window.location.href = callbackUrl;
            }
        } catch {
            setError('Đã có lỗi xảy ra. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const inputClassName = "w-full pl-12 pr-4 py-4 h-auto bg-[var(--material-panel)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-ring border border-[var(--border-color)] transition-all";

    return (
        <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center px-6 py-20">
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
                    <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Đăng Nhập</h1>
                    <p className="text-[var(--text-secondary)]">Chào mừng bạn quay trở lại</p>
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
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                        {/* Email */}
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                                                <Mail size={20} strokeWidth={1.5} />
                                            </span>
                                            <Input
                                                type="email"
                                                placeholder="you@example.com"
                                                className={inputClassName}
                                                disabled={loading}
                                                {...field}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Password */}
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mật khẩu</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                                                <Lock size={20} strokeWidth={1.5} />
                                            </span>
                                            <Input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                className="w-full pl-12 pr-12 py-4 h-auto bg-[var(--material-panel)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-ring border border-[var(--border-color)] transition-all"
                                                disabled={loading}
                                                {...field}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((value) => !value)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            >
                                                {showPassword ? <EyeOff size={20} strokeWidth={1.8} /> : <Eye size={20} strokeWidth={1.8} />}
                                            </button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Remember & Forgot */}
                        <div className="flex items-center justify-between">
                            <FormField
                                control={form.control}
                                name="remember"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormLabel className="text-[var(--text-secondary)] text-sm cursor-pointer font-normal">
                                            Ghi nhớ đăng nhập
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                            <Link href="/forgot-password" className="text-[var(--text-secondary)] text-sm hover:underline">
                                Quên mật khẩu?
                            </Link>
                        </div>

                        {/* Submit */}
                        <Button
                            type="submit"
                            variant="default"
                            size="lg"
                            className="w-full"
                            disabled={loading}
                        >
                            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                        </Button>
                    </form>
                </Form>

                {/* Divider */}
                <div className="flex items-center gap-4 my-8">
                    <div className="flex-1 h-px bg-[var(--material-glass)]" />
                    <span className="text-[var(--text-tertiary)] text-sm">hoặc</span>
                    <div className="flex-1 h-px bg-[var(--material-glass)]" />
                </div>

                {/* Google Login */}
                <button
                    onClick={() => {
                        if (!googleEnabled) {
                            setError('Google login chưa được cấu hình trên server.');
                            return;
                        }
                        sessionStorage.setItem('miniver.returnTo', callbackUrl);
                        signIn('google', { callbackUrl: `/api/auth/google-callback?callbackUrl=${encodeURIComponent(callbackUrl)}` });
                    }}
                    disabled={loading || !googleEnabled}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-[var(--material-glass)] hover:opacity-80 border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-medium transition-all disabled:opacity-50"
                    title={googleEnabled ? 'Đăng nhập bằng Google' : 'Google login chưa được cấu hình'}
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
                <p className="text-center text-[var(--text-secondary)] mt-8">
                    Chưa có tài khoản?{' '}
                    <Link href="/register" className="text-[var(--text-primary)] font-medium hover:underline">
                        Đăng ký ngay
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}

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
