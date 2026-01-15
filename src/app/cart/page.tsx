'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/Button';

// Mock cart data
const initialCartItems = [
    { id: 1, name: 'Dragon Figure', size: 'M (15cm)', price: 450000, quantity: 1, emoji: '🐉' },
    { id: 2, name: 'Superhero Bust', size: 'S (8cm)', price: 450000, quantity: 2, emoji: '🦸' },
];

export default function CartPage() {
    const [cartItems, setCartItems] = useState(initialCartItems);

    const updateQuantity = (id: number, delta: number) => {
        setCartItems(items =>
            items.map(item =>
                item.id === id
                    ? { ...item, quantity: Math.max(1, item.quantity + delta) }
                    : item
            )
        );
    };

    const removeItem = (id: number) => {
        setCartItems(items => items.filter(item => item.id !== id));
    };

    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deposit = Math.round(subtotal * 0.5);

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[1000px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                        Giỏ Hàng
                    </h1>
                    <p className="text-white/50 mt-2">
                        {cartItems.length} sản phẩm trong giỏ
                    </p>
                </AnimatedSection>

                {cartItems.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Cart Items */}
                        <div className="lg:col-span-2 space-y-4">
                            {cartItems.map((item, index) => (
                                <AnimatedSection key={item.id} delay={index * 0.05}>
                                    <motion.div
                                        layout
                                        className="bg-[#1D1D1F] rounded-2xl p-6 flex gap-6"
                                    >
                                        {/* Product Image */}
                                        <div className="w-24 h-24 rounded-xl bg-[#2D2D2F] flex items-center justify-center flex-shrink-0">
                                            <span className="text-4xl">{item.emoji}</span>
                                        </div>

                                        {/* Product Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <h3 className="font-semibold text-white">{item.name}</h3>
                                                    <p className="text-sm text-white/50">{item.size}</p>
                                                </div>
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="text-white/40 hover:text-red-500 transition-colors"
                                                    data-cursor
                                                >
                                                    ×
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between mt-4">
                                                {/* Quantity */}
                                                <div className="inline-flex items-center bg-[#2D2D2F] rounded-full">
                                                    <button
                                                        onClick={() => updateQuantity(item.id, -1)}
                                                        className="w-8 h-8 flex items-center justify-center text-white hover:text-[#0071E3] transition-colors"
                                                        data-cursor
                                                    >
                                                        −
                                                    </button>
                                                    <span className="w-8 text-center text-white text-sm">{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, 1)}
                                                        className="w-8 h-8 flex items-center justify-center text-white hover:text-[#0071E3] transition-colors"
                                                        data-cursor
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                {/* Price */}
                                                <p className="font-semibold text-white">
                                                    {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                </AnimatedSection>
                            ))}
                        </div>

                        {/* Order Summary */}
                        <div className="lg:col-span-1">
                            <AnimatedSection delay={0.2}>
                                <div className="bg-[#1D1D1F] rounded-3xl p-8 sticky top-28">
                                    <h2 className="text-xl font-semibold text-white mb-6">
                                        Tóm Tắt Đơn Hàng
                                    </h2>

                                    <div className="space-y-3 mb-6 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Tạm tính</span>
                                            <span className="text-white">{subtotal.toLocaleString('vi-VN')}đ</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Phí vận chuyển</span>
                                            <span className="text-white/60">Tính khi thanh toán</span>
                                        </div>
                                    </div>

                                    <div className="border-t border-white/10 pt-4 mb-4">
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-white/60">Đặt cọc (50%)</span>
                                            <span className="text-2xl font-bold text-[#0071E3]">
                                                {deposit.toLocaleString('vi-VN')}đ
                                            </span>
                                        </div>
                                        <p className="text-white/40 text-xs mt-1">
                                            Thanh toán phần còn lại khi nhận hàng
                                        </p>
                                    </div>

                                    <Link href="/checkout">
                                        <Button variant="primary" size="lg" className="w-full mb-4">
                                            Thanh toán
                                        </Button>
                                    </Link>

                                    <Link href="/products">
                                        <Button variant="outline" size="lg" className="w-full">
                                            Tiếp tục mua sắm
                                        </Button>
                                    </Link>
                                </div>
                            </AnimatedSection>
                        </div>
                    </div>
                ) : (
                    /* Empty Cart */
                    <AnimatedSection className="text-center py-20">
                        <span className="text-6xl mb-6 block">🛒</span>
                        <h2 className="text-2xl font-semibold text-white mb-4">
                            Giỏ hàng trống
                        </h2>
                        <p className="text-white/50 mb-8">
                            Hãy thêm sản phẩm để bắt đầu mua sắm
                        </p>
                        <Link href="/products">
                            <Button variant="primary" size="lg">
                                Khám phá sản phẩm
                            </Button>
                        </Link>
                    </AnimatedSection>
                )}
            </div>
        </div>
    );
}
