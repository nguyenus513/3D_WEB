'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

/**
 * Custom 404 Page - Apple Style
 */
export default function NotFound() {
    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center max-w-lg"
            >
                {/* 404 Number */}
                <motion.h1
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-[120px] md:text-[180px] font-bold leading-none"
                    style={{
                        background: 'linear-gradient(135deg, #0071E3, #A855F7)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                >
                    404
                </motion.h1>

                {/* Message */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    <h2 className="text-2xl md:text-3xl font-semibold text-[var(--text-primary)] mb-4">
                        Trang không tồn tại
                    </h2>
                    <p className="text-[var(--text-secondary)] mb-8">
                        Xin lỗi, trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
                    </p>
                </motion.div>

                {/* Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="flex flex-col sm:flex-row gap-4 justify-center"
                >
                    <Link
                        href="/"
                        className="px-8 py-3 bg-[var(--color-accent)] text-white font-medium rounded-full hover:bg-[var(--color-accent-hover)] transition-all hover:scale-105"
                    >
                        Về trang chủ
                    </Link>
                    <Link
                        href="/products"
                        className="px-8 py-3 bg-[var(--bg-secondary)] text-[var(--text-primary)] font-medium rounded-full hover:bg-[var(--bg-tertiary)] transition-all"
                    >
                        Xem sản phẩm
                    </Link>
                </motion.div>

                {/* Decorative elements */}
                <motion.div
                    className="absolute inset-0 pointer-events-none overflow-hidden -z-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                >
                    <div
                        className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-3xl opacity-20"
                        style={{ background: 'radial-gradient(circle, #0071E3, transparent)' }}
                    />
                    <div
                        className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-20"
                        style={{ background: 'radial-gradient(circle, #A855F7, transparent)' }}
                    />
                </motion.div>
            </motion.div>
        </div>
    );
}
