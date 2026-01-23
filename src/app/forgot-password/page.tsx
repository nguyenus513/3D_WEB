'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

/**
 * Forgot Password Page
 * Allows users to request a password reset email
 */
export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Có lỗi xảy ra');
            }

            setSent(true);
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
                        Quên mật khẩu?
                    </h1>
                    <p className="text-[var(--text-secondary)]">
                        {sent
                            ? 'Kiểm tra email của bạn để đặt lại mật khẩu'
                            : 'Nhập email để nhận link đặt lại mật khẩu'}
                    </p>
                </div>

                {/* Success State */}
                {sent ? (
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
                            Email đã được gửi!
                        </h2>
                        <p className="text-[var(--text-secondary)] mb-6">
                            Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến <strong>{email}</strong>
                        </p>
                        <Link
                            href="/login"
                            className="inline-block px-6 py-3 bg-[var(--color-accent)] text-white rounded-full font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
                        >
                            Quay lại đăng nhập
                        </Link>
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

                        {/* Email Input */}
                        <div className="mb-6">
                            <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="email@example.com"
                                required
                                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-[var(--color-accent)] text-white rounded-full font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Đang gửi...
                                </>
                            ) : (
                                'Gửi link đặt lại mật khẩu'
                            )}
                        </button>

                        {/* Back to Login */}
                        <p className="mt-6 text-center text-[var(--text-secondary)]">
                            Nhớ mật khẩu?{' '}
                            <Link href="/login" className="text-[var(--color-accent)] hover:underline">
                                Đăng nhập
                            </Link>
                        </p>
                    </form>
                )}
            </motion.div>
        </div>
    );
}
