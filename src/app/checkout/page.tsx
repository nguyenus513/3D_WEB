'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// Mock order data (in real app, this would come from cart state)
const orderItems = [
    { id: 1, name: 'Dragon Figure', size: 'M (15cm)', price: 450000, quantity: 1 },
    { id: 2, name: 'Superhero Bust', size: 'S (8cm)', price: 450000, quantity: 2 },
];

type PaymentMethod = 'payos' | 'momo' | 'bank';

const paymentMethods = [
    { id: 'payos' as PaymentMethod, name: 'PayOS QR', desc: 'Quét mã thanh toán', icon: '🏦' },
    { id: 'momo' as PaymentMethod, name: 'MoMo', desc: 'Ví điện tử MoMo', icon: '💜' },
    { id: 'bank' as PaymentMethod, name: 'Chuyển khoản', desc: 'Ngân hàng nội địa', icon: '🏧' },
];

export default function CheckoutPage() {
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('payos');
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        note: '',
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = 30000;
    const total = subtotal + shipping;
    const deposit = Math.round(total * 0.5);

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[1200px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="mb-12">
                    <Link href="/cart" className="text-[#0071E3] text-sm mb-4 inline-flex items-center gap-2 hover:gap-4 transition-all">
                        ← Quay lại giỏ hàng
                    </Link>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                        Thanh Toán
                    </h1>
                </AnimatedSection>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left - Customer Info & Payment */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Delivery Info */}
                        <AnimatedSection delay={0.1}>
                            <div className="bg-[#1D1D1F] rounded-3xl p-8">
                                <h2 className="text-xl font-semibold text-white mb-6">
                                    Thông Tin Giao Hàng
                                </h2>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="Họ tên"
                                            placeholder="Nhập họ tên"
                                            value={formData.name}
                                            onChange={(e) => handleInputChange('name', e.target.value)}
                                        />
                                        <Input
                                            label="Số điện thoại"
                                            placeholder="Nhập số điện thoại"
                                            value={formData.phone}
                                            onChange={(e) => handleInputChange('phone', e.target.value)}
                                        />
                                    </div>
                                    <Input
                                        label="Email"
                                        type="email"
                                        placeholder="Nhập địa chỉ email"
                                        value={formData.email}
                                        onChange={(e) => handleInputChange('email', e.target.value)}
                                    />
                                    <Input
                                        label="Địa chỉ giao hàng"
                                        placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                                        value={formData.address}
                                        onChange={(e) => handleInputChange('address', e.target.value)}
                                    />
                                    <div>
                                        <label className="text-white/70 text-sm mb-2 block">Ghi chú</label>
                                        <textarea
                                            placeholder="Ghi chú cho đơn hàng (tùy chọn)"
                                            className="w-full p-4 bg-[#2D2D2F] rounded-xl text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-[#0071E3] border border-white/5"
                                            rows={3}
                                            value={formData.note}
                                            onChange={(e) => handleInputChange('note', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </AnimatedSection>

                        {/* Payment Method */}
                        <AnimatedSection delay={0.2}>
                            <div className="bg-[#1D1D1F] rounded-3xl p-8">
                                <h2 className="text-xl font-semibold text-white mb-6">
                                    Phương Thức Thanh Toán
                                </h2>

                                <div className="space-y-3">
                                    {paymentMethods.map((method) => (
                                        <button
                                            key={method.id}
                                            onClick={() => setPaymentMethod(method.id)}
                                            className={`
                        w-full p-4 rounded-xl flex items-center gap-4 transition-all text-left
                        ${paymentMethod === method.id
                                                    ? 'bg-[#0071E3]/20 border-2 border-[#0071E3]'
                                                    : 'bg-[#2D2D2F] border-2 border-transparent hover:border-white/10'
                                                }
                      `}
                                            data-cursor
                                        >
                                            <span className="text-2xl">{method.icon}</span>
                                            <div>
                                                <p className="text-white font-medium">{method.name}</p>
                                                <p className="text-white/50 text-sm">{method.desc}</p>
                                            </div>
                                            {paymentMethod === method.id && (
                                                <span className="ml-auto text-[#0071E3]">✓</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </AnimatedSection>
                    </div>

                    {/* Right - Order Summary */}
                    <div className="lg:col-span-1">
                        <AnimatedSection delay={0.3}>
                            <div className="bg-[#1D1D1F] rounded-3xl p-8 sticky top-28">
                                <h2 className="text-xl font-semibold text-white mb-6">
                                    Đơn Hàng
                                </h2>

                                {/* Items */}
                                <div className="space-y-4 mb-6">
                                    {orderItems.map((item) => (
                                        <div key={item.id} className="flex justify-between items-start">
                                            <div>
                                                <p className="text-white text-sm">{item.name}</p>
                                                <p className="text-white/50 text-xs">{item.size} x{item.quantity}</p>
                                            </div>
                                            <p className="text-white text-sm">
                                                {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {/* Totals */}
                                <div className="border-t border-white/10 pt-4 space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Tạm tính</span>
                                        <span className="text-white">{subtotal.toLocaleString('vi-VN')}đ</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Phí vận chuyển</span>
                                        <span className="text-white">{shipping.toLocaleString('vi-VN')}đ</span>
                                    </div>
                                    <div className="flex justify-between font-medium">
                                        <span className="text-white">Tổng cộng</span>
                                        <span className="text-white">{total.toLocaleString('vi-VN')}đ</span>
                                    </div>
                                </div>

                                {/* Deposit */}
                                <div className="mt-4 p-4 bg-[#0071E3]/10 rounded-xl border border-[#0071E3]/30">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-white/70 text-sm">Thanh toán ngay (50%)</span>
                                        <span className="text-xl font-bold text-[#0071E3]">
                                            {deposit.toLocaleString('vi-VN')}đ
                                        </span>
                                    </div>
                                    <p className="text-white/40 text-xs mt-1">
                                        Còn lại thanh toán khi nhận hàng
                                    </p>
                                </div>

                                <Button variant="primary" size="lg" className="w-full mt-6">
                                    Thanh toán {deposit.toLocaleString('vi-VN')}đ
                                </Button>

                                <p className="text-white/40 text-xs text-center mt-4">
                                    Bằng việc đặt hàng, bạn đồng ý với{' '}
                                    <Link href="/terms" className="text-[#0071E3]">Điều khoản dịch vụ</Link>
                                </p>
                            </div>
                        </AnimatedSection>
                    </div>
                </div>
            </div>
        </div>
    );
}
