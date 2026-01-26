'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/Button';
import { useCart, CartItem } from '@/lib/store/cart';
import { AddressSelector, ShippingAddress } from '@/components/checkout/AddressSelector';

// Icons
const ProductIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
);

const PrintIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
    </svg>
);

const CustomIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

// Item row in order summary
function OrderItem({ item }: { item: CartItem }) {
    const getTypeIcon = () => {
        switch (item.type) {
            case 'product': return <ProductIcon />;
            case 'print': return <PrintIcon />;
            case 'custom': return <CustomIcon />;
        }
    };

    return (
        <div className="flex justify-between items-start py-3 border-b border-white/10 last:border-b-0">
            <div className="flex items-start gap-3 flex-1">
                <span className="text-white/50 mt-0.5">{getTypeIcon()}</span>
                <div>
                    <p className="text-white font-medium">{item.name}</p>
                    <p className="text-white/50 text-sm">
                        {item.type === 'product' && item.size && `Size: ${item.size} • `}
                        {item.type === 'print' && item.printOptions && `${item.printOptions.type.toUpperCase()} • `}
                        SL: {item.quantity}
                    </p>
                </div>
            </div>
            <p className="text-white font-medium">
                {(item.price * item.quantity).toLocaleString('vi-VN')}đ
            </p>
        </div>
    );
}

export default function CheckoutPage() {
    const router = useRouter();
    const { items, totalPrice, productItems, printItems, customItems, clearCart } = useCart();
    const { data: session, status } = useSession();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [user, setUser] = useState<{ id: string; email: string } | null>(null);
    const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
    const [note, setNote] = useState('');

    // Calculate totals by type
    const productTotal = productItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const printTotal = printItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const customTotal = customItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Products & 3D Print = 100% payment, Custom = 50% deposit
    const fullPaymentAmount = productTotal + printTotal; // 100%
    const customDepositAmount = Math.round(customTotal * 0.5); // 50% for custom
    const payNowAmount = fullPaymentAmount + customDepositAmount;
    const remainingAmount = customTotal - customDepositAmount; // Remaining for custom items

    const hasCustomItems = customItems.length > 0;

    // Auth check on mount
    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            router.push('/login?redirect=/checkout');
            return;
        }

        fetchUserData();
    }, [status, session, router]);

    const fetchUserData = async () => {
        if (!session?.user?.email) return;

        try {
            const res = await fetch('/api/profile');
            if (res.ok) {
                const userData = await res.json();
                setUser({ id: userData.id, email: session.user.email });
            }
        } catch (e) {
            console.error('Failed to fetch profile', e);
        }
        setLoading(false);
    };

    const handleCheckout = async () => {
        // Validate shipping address
        if (!shippingAddress || !shippingAddress.full_name || !shippingAddress.phone || !shippingAddress.province) {
            setError('Vui lòng nhập đầy đủ thông tin địa chỉ giao hàng');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            // First, save address if it's new (without id)
            let addressId = shippingAddress.id;

            if (!addressId) {
                const addrRes = await fetch('/api/addresses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(shippingAddress),
                });
                const addrResult = await addrRes.json();
                if (addrRes.ok && addrResult.address) {
                    addressId = addrResult.address.id;
                } else {
                    throw new Error('Không thể lưu địa chỉ');
                }
            }

            // Create master order via API
            const res = await fetch('/api/orders/master', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    addressId,
                    items,
                    note,
                    shipping: 0, // No shipping fee
                }),
            });

            const result = await res.json();

            if (res.ok && result.masterOrderNumber) {
                clearCart();
                router.push(`/checkout/success/${result.masterOrderNumber}`);
            } else {
                setError(result.error || 'Có lỗi xảy ra khi tạo đơn hàng');
            }
        } catch (err) {
            setError((err as Error).message);
        }

        setSubmitting(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-32 pb-20 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white/50">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-32 pb-20 flex items-center justify-center px-6">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-4">Giỏ hàng trống</h2>
                    <Link href="/products" className="px-6 py-3 bg-white text-black rounded-xl font-medium">
                        Xem sản phẩm
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[1000px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="text-center mb-10">
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Thanh Toán</h1>
                    <p className="text-white/60">Xác nhận thông tin đơn hàng của bạn</p>
                </AnimatedSection>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* Left - Address & Note */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Order Summary Card */}
                        <AnimatedSection delay={0.1}>
                            <div className="bg-[#2D2D2F] rounded-2xl p-6">
                                <h3 className="text-white font-medium mb-4">🛒 Tóm tắt đơn hàng</h3>
                                <div className="space-y-1">
                                    {/* Products - 100% payment */}
                                    {productItems.length > 0 && (
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-blue-400">
                                                    <ProductIcon />
                                                    <span className="text-sm font-medium">Sản phẩm ({productItems.length})</span>
                                                </div>
                                                <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">100%</span>
                                            </div>
                                            {productItems.map((item) => (
                                                <OrderItem key={item.id} item={item} />
                                            ))}
                                        </div>
                                    )}

                                    {/* 3D Prints - 100% payment */}
                                    {printItems.length > 0 && (
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-purple-400">
                                                    <PrintIcon />
                                                    <span className="text-sm font-medium">In 3D ({printItems.length})</span>
                                                </div>
                                                <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">100%</span>
                                            </div>
                                            {printItems.map((item) => (
                                                <OrderItem key={item.id} item={item} />
                                            ))}
                                        </div>
                                    )}

                                    {/* Custom - 50% deposit */}
                                    {customItems.length > 0 && (
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-orange-400">
                                                    <CustomIcon />
                                                    <span className="text-sm font-medium">Custom ({customItems.length})</span>
                                                </div>
                                                <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded">Cọc 50%</span>
                                            </div>
                                            {customItems.map((item) => (
                                                <OrderItem key={item.id} item={item} />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Price summary */}
                                <div className="border-t border-white/10 pt-4 space-y-2 text-sm">
                                    {(productItems.length > 0 || printItems.length > 0) && (
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Sản phẩm + In 3D (100%)</span>
                                            <span className="text-white">{fullPaymentAmount.toLocaleString('vi-VN')}đ</span>
                                        </div>
                                    )}
                                    {customItems.length > 0 && (
                                        <>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Custom (tổng giá)</span>
                                                <span className="text-white">{customTotal.toLocaleString('vi-VN')}đ</span>
                                            </div>
                                            <div className="flex justify-between text-orange-400">
                                                <span>└ Cọc 50%</span>
                                                <span>{customDepositAmount.toLocaleString('vi-VN')}đ</span>
                                            </div>
                                        </>
                                    )}
                                    <div className="border-t border-white/10 pt-2 flex justify-between">
                                        <span className="text-white font-medium">Tổng đơn hàng</span>
                                        <span className="text-white font-bold text-lg">
                                            {totalPrice.toLocaleString('vi-VN')}đ
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </AnimatedSection>

                        {/* Shipping Address Card */}
                        <AnimatedSection delay={0.2}>
                            <div className="bg-[#2D2D2F] rounded-2xl p-6">
                                <h3 className="text-white font-medium mb-4">📍 Địa chỉ giao hàng</h3>
                                <AddressSelector
                                    userId={user?.id}
                                    value={shippingAddress}
                                    onChange={setShippingAddress}
                                    disabled={submitting}
                                />
                            </div>
                        </AnimatedSection>

                        {/* Note Card */}
                        <AnimatedSection delay={0.3}>
                            <div className="bg-[#2D2D2F] rounded-2xl p-6">
                                <h3 className="text-white font-medium mb-4">📝 Ghi chú</h3>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Ghi chú cho đơn hàng (tùy chọn)"
                                    className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-white/30"
                                    rows={3}
                                />
                            </div>
                        </AnimatedSection>
                    </div>

                    {/* Right - Checkout Button */}
                    <div className="lg:col-span-2">
                        <AnimatedSection delay={0.4}>
                            <div className="bg-[#2D2D2F] rounded-2xl p-6 sticky top-28">
                                <h3 className="text-white font-medium mb-4">💳 Thanh toán</h3>

                                <div className="space-y-3 text-sm mb-6">
                                    {(productItems.length > 0 || printItems.length > 0) && (
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Sản phẩm + In 3D</span>
                                            <span className="text-white">{fullPaymentAmount.toLocaleString('vi-VN')}đ</span>
                                        </div>
                                    )}
                                    {customItems.length > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Cọc Custom (50%)</span>
                                            <span className="text-white">{customDepositAmount.toLocaleString('vi-VN')}đ</span>
                                        </div>
                                    )}
                                    <div className="border-t border-white/10 pt-3 flex justify-between">
                                        <span className="text-white font-medium">Tổng đơn</span>
                                        <span className="text-white">{totalPrice.toLocaleString('vi-VN')}đ</span>
                                    </div>
                                </div>

                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-green-400 text-sm">Thanh toán ngay</span>
                                        <span className="text-xl font-bold text-green-400">
                                            {payNowAmount.toLocaleString('vi-VN')}đ
                                        </span>
                                    </div>
                                    {hasCustomItems && remainingAmount > 0 && (
                                        <p className="text-white/40 text-xs mt-1">
                                            Còn lại {remainingAmount.toLocaleString('vi-VN')}đ khi nhận hàng Custom
                                        </p>
                                    )}
                                </div>

                                {/* Error message */}
                                {error && (
                                    <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}

                                <Button
                                    variant="primary"
                                    size="lg"
                                    className="w-full"
                                    onClick={handleCheckout}
                                    disabled={submitting || !shippingAddress}
                                >
                                    {submitting ? (
                                        <span className="flex items-center gap-2">
                                            <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                            Đang xử lý...
                                        </span>
                                    ) : (
                                        `Đặt hàng - ${payNowAmount.toLocaleString('vi-VN')}đ`
                                    )}
                                </Button>

                                <p className="text-white/40 text-xs text-center mt-4">
                                    Bằng việc đặt hàng, bạn đồng ý với{' '}
                                    <Link href="/terms" className="text-white/60 hover:text-white">Điều khoản dịch vụ</Link>
                                </p>
                            </div>
                        </AnimatedSection>
                    </div>
                </div>
            </div>
        </div>
    );
}
