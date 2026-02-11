'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

/**
 * Global Error Page - Apple Style
 */
export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log error to monitoring service
        console.error('Application Error:', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center max-w-lg"
            >
                {/* Error Icon */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.5, type: 'spring' }}
                    className="w-24 h-24 mx-auto mb-8 rounded-full bg-red-500/10 flex items-center justify-center"
                >
                    <AlertTriangle size={48} className="text-red-500" strokeWidth={1.5} />
                </motion.div>

                {/* Message */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <h2 className="text-2xl md:text-3xl font-semibold text-[var(--text-primary)] mb-4">
                        Đã xảy ra lỗi
                    </h2>
                    <p className="text-[var(--text-secondary)] mb-8">
                        Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ hỗ trợ nếu vấn đề tiếp tục.
                    </p>
                </motion.div>

                {/* Error digest for debugging */}
                {error.digest && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-xs text-[var(--text-tertiary)] mb-6 font-mono"
                    >
                        Mã lỗi: {error.digest}
                    </motion.p>
                )}

                {/* Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-col sm:flex-row gap-4 justify-center"
                >
                    <button
                        onClick={reset}
                        className="px-8 py-3 bg-[var(--color-accent)] text-white font-medium rounded-full hover:bg-[var(--color-accent-hover)] transition-all hover:scale-105"
                    >
                        Thử lại
                    </button>
                    <Link
                        href="/"
                        className="px-8 py-3 bg-[var(--bg-secondary)] text-[var(--text-primary)] font-medium rounded-full hover:bg-[var(--bg-tertiary)] transition-all"
                    >
                        Về trang chủ
                    </Link>
                </motion.div>
            </motion.div>
        </div>
    );
}
