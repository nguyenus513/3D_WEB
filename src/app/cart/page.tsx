'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/store/cart';

export default function CartPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const { items, totalPrice, updateQuantity, removeItem, clearCart } = useCart();

    const handleCheckout = () => {
        if (status === 'loading') return;

        if (!session) {
            // Redirect to login with return URL
            router.push('/login?redirect=/checkout');
            return;
        }

        // User is authenticated, proceed to checkout
        router.push('/checkout');
    };

    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-32 pb-20 flex items-center justify-center px-6">
                <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">Giỏ hàng trống</h2>
                    <p className="text-white/50 mb-8">Bạn chưa có sản phẩm nào trong giỏ hàng</p>
                    <Link href="/products" className="px-8 py-4 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors">
                        Xem sản phẩm
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[1200px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                        Giỏ Hàng
                    </h1>
                    <p className="text-white/50 mt-2">{items.length} sản phẩm</p>
                </AnimatedSection>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Items List */}
                    <div className="lg:col-span-2 space-y-4">
                        {items.map((item, index) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-[#1D1D1F] rounded-2xl p-6 flex items-start gap-6"
                            >
                                {/* Image placeholder */}
                                <div className="w-24 h-24 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                                    <svg className="w-10 h-10 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                </div>

                                {/* Info */}
                                <div className="flex-1">
                                    <h3 className="text-white font-semibold text-lg">{item.name}</h3>
                                    <p className="text-white/50 text-sm mt-1">
                                        {item.size && `Size: ${item.size}`}
                                    </p>
                                    <p className="text-white font-medium mt-2">
                                        {item.price.toLocaleString('vi-VN')}đ
                                    </p>
                                </div>

                                {/* Quantity */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                        className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                                    >
                                        -
                                    </button>
                                    <span className="text-white w-8 text-center">{item.quantity}</span>
                                    <button
                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                        className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                                    >
                                        +
                                    </button>
                                </div>

                                {/* Remove */}
                                <button
                                    onClick={() => removeItem(item.id)}
                                    className="p-2 text-white/40 hover:text-red-400"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </motion.div>
                        ))}

                        {/* Clear cart */}
                        <button
                            onClick={clearCart}
                            className="text-red-400 text-sm hover:text-red-300"
                        >
                            Xóa tất cả
                        </button>
                    </div>

                    {/* Summary */}
                    <div className="lg:col-span-1">
                        <AnimatedSection delay={0.2}>
                            <div className="bg-[#1D1D1F] rounded-2xl p-6 sticky top-28">
                                <h2 className="text-xl font-semibold text-white mb-6">Tóm tắt đơn hàng</h2>

                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Tạm tính ({items.length} sản phẩm)</span>
                                        <span className="text-white">{totalPrice.toLocaleString('vi-VN')}đ</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Phí vận chuyển</span>
                                        <span className="text-white">30.000đ</span>
                                    </div>
                                </div>

                                <div className="border-t border-white/10 my-4" />

                                <div className="flex justify-between mb-6">
                                    <span className="text-white font-medium">Tổng cộng</span>
                                    <span className="text-white text-xl font-bold">
                                        {(totalPrice + 30000).toLocaleString('vi-VN')}đ
                                    </span>
                                </div>

                                <Button
                                    variant="primary"
                                    size="lg"
                                    className="w-full"
                                    onClick={handleCheckout}
                                    disabled={status === 'loading'}
                                >
                                    {status === 'loading' ? 'Đang kiểm tra...' :
                                        !session ? 'Đăng nhập để thanh toán' : 'Tiến hành thanh toán'}
                                </Button>

                                <Link href="/products" className="block text-center mt-4 text-white/50 text-sm hover:text-white">
                                    ← Tiếp tục mua sắm
                                </Link>
                            </div>
                        </AnimatedSection>
                    </div>
                </div>
            </div>
        </div>
    );
}
