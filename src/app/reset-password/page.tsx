'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

/**
 * Reset Password Page
 * Allows users to set a new password using reset token
 */
function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) {
            setError('Link đặt lại mật khẩu không hợp lệ');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Validate passwords match
        if (password !== confirmPassword) {
            setError('Mật khẩu không khớp');
            setLoading(false);
            return;
        }

        // Validate password strength
        if (password.length < 8) {
            setError('Mật khẩu phải có ít nhất 8 ký tự');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Có lỗi xảy ra');
            }

            setSuccess(true);
            setTimeout(() => router.push('/login'), 3000);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-6 pt-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
                        Đặt lại mật khẩu
                    </h1>
                    <p className="text-[var(--text-secondary)]">
                        {success ? 'Mật khẩu đã được cập nhật!' : 'Nhập mật khẩu mới của bạn'}
                    </p>
                </div>

                {/* Success State */}
                {success ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[var(--card-bg)] rounded-2xl p-8 border border-[var(--card-border)] text-center"
                    >
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                            Thành công!
                        </h2>
                        <p className="text-[var(--text-secondary)] mb-4">
                            Mật khẩu của bạn đã được cập nhật. Đang chuyển hướng...
                        </p>
                        <div className="w-6 h-6 mx-auto border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                    </motion.div>
                ) : (
                    /* Form */
                    <form onSubmit={handleSubmit} className="bg-[var(--card-bg)] rounded-2xl p-8 border border-[var(--card-border)]">
                        {/* Error Message */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Invalid Token State */}
                        {!token ? (
                            <div className="text-center">
                                <p className="text-[var(--text-secondary)] mb-4">
                                    Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.
                                </p>
                                <Link
                                    href="/forgot-password"
                                    className="text-[var(--color-accent)] hover:underline"
                                >
                                    Yêu cầu link mới
                                </Link>
                            </div>
                        ) : (
                            <>
                                {/* Password Input */}
                                <div className="mb-4">
                                    <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                        Mật khẩu mới
                                    </label>
                                    <input
                                        type="password"
                                        id="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Ít nhất 8 ký tự"
                                        required
                                        minLength={8}
                                        className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all"
                                    />
                                </div>

                                {/* Confirm Password Input */}
                                <div className="mb-6">
                                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                        Xác nhận mật khẩu
                                    </label>
                                    <input
                                        type="password"
                                        id="confirmPassword"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Nhập lại mật khẩu"
                                        required
                                        className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all"
                                    />
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-[var(--color-accent)] text-[var(--text-primary)] rounded-full font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-[var(--text-tertiary)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                                            Đang cập nhật...
                                        </>
                                    ) : (
                                        'Đặt lại mật khẩu'
                                    )}
                                </button>
                            </>
                        )}
                    </form>
                )}
            </motion.div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}
