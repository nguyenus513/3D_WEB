'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCart, CartItem } from '@/lib/store/cart';

interface Address {
    id: string;
    label: string;
    full_name: string;
    phone: string;
    address_line: string;
    ward?: string;
    district?: string;
    province: string;
    is_default: boolean;
}

// Icons
const ProductIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
);

const PrintIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
    </svg>
);

const CustomIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="flex justify-between items-start py-2">
            <div className="flex items-start gap-2 flex-1">
                <span className="text-white/40 mt-0.5">{getTypeIcon()}</span>
                <div>
                    <p className="text-white text-sm">{item.name}</p>
                    <p className="text-white/50 text-xs">
                        {item.type === 'product' && item.size && `Size: ${item.size} • `}
                        {item.type === 'print' && item.printOptions && `${item.printOptions.type.toUpperCase()} • `}
                        x{item.quantity}
                    </p>
                </div>
            </div>
            <p className="text-white text-sm">
                {(item.price * item.quantity).toLocaleString('vi-VN')}đ
            </p>
        </div>
    );
}

export default function CheckoutPage() {
    const router = useRouter();
    const { items, totalPrice, groupedTotals, productItems, printItems, customItems, clearCart } = useCart();
    const { data: session, status } = useSession();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [user, setUser] = useState<{ id: string; email: string } | null>(null);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
    const [showAddNew, setShowAddNew] = useState(false);
    const [newAddress, setNewAddress] = useState({
        label: 'Nhà',
        full_name: '',
        phone: '',
        address_line: '',
        province: '',
    });
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const shipping = 30000;
    const total = totalPrice + shipping;
    const deposit = Math.round(total * 0.5);

    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            router.push('/login?redirect=/checkout');
            return;
        }

        if (session?.user?.email) {
            loadUserAndAddresses();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, session]);

    const loadUserAndAddresses = async () => {
        if (!session?.user?.email) return;

        let userId = '';
        try {
            const res = await fetch('/api/profile');
            if (res.ok) {
                const user = await res.json();
                userId = user.id;
            }
        } catch (e) {
            console.error('Failed to fetch profile', e);
        }

        if (!userId) {
            setLoading(false);
            return;
        }

        setUser({ id: userId, email: session.user.email });

        try {
            const res = await fetch('/api/addresses');
            if (res.ok) {
                const data = await res.json();
                const addressList = data.addresses || [];
                if (addressList.length > 0) {
                    setAddresses(addressList);
                    const defaultAddr = addressList.find((a: Address) => a.is_default) || addressList[0];
                    setSelectedAddressId(defaultAddr.id);
                } else {
                    setShowAddNew(true);
                }
            }
        } catch (err) {
            console.error('Failed to load addresses:', err);
        }

        setLoading(false);
    };

    const handleAddNewAddress = async () => {
        if (!newAddress.full_name || !newAddress.phone || !newAddress.address_line || !newAddress.province) {
            return;
        }

        setSaving(true);

        try {
            const res = await fetch('/api/addresses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newAddress,
                    is_default: addresses.length === 0,
                }),
            });
            const result = await res.json();

            if (res.ok && result.address) {
                setAddresses(prev => [...prev, result.address]);
                setSelectedAddressId(result.address.id);
                setShowAddNew(false);
                setNewAddress({ label: 'Nhà', full_name: '', phone: '', address_line: '', province: '' });
            }
        } catch (err) {
            console.error('Failed to add address:', err);
        }

        setSaving(false);
    };

    const handleCheckout = async () => {
        if (!selectedAddressId || submitting) return;

        setSubmitting(true);

        try {
            // Create master order via API
            const res = await fetch('/api/orders/master', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    addressId: selectedAddressId,
                    items: items,
                    note: note,
                    shipping: shipping,
                }),
            });

            const result = await res.json();

            if (res.ok && result.masterOrderNumber) {
                // Clear cart and redirect to success page
                clearCart();
                router.push(`/checkout/success/${result.masterOrderNumber}`);
            } else {
                console.error('Failed to create order:', result.error);
                alert('Có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại.');
            }
        } catch (err) {
            console.error('Checkout error:', err);
            alert('Có lỗi xảy ra. Vui lòng thử lại.');
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
            <div className="max-w-[1200px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="mb-12">
                    <Link href="/cart" className="text-white/70 text-sm mb-4 inline-flex items-center gap-2 hover:gap-4 transition-all">
                        ← Quay lại giỏ hàng
                    </Link>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                        Thanh Toán
                    </h1>
                </AnimatedSection>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left - Delivery Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Saved Addresses */}
                        <AnimatedSection delay={0.1}>
                            <div className="bg-[#1D1D1F] rounded-3xl p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-semibold text-white">
                                        Địa Chỉ Giao Hàng
                                    </h2>
                                    {addresses.length > 0 && !showAddNew && (
                                        <button
                                            onClick={() => setShowAddNew(true)}
                                            className="text-sm text-blue-400 hover:text-blue-300 cursor-pointer"
                                        >
                                            + Thêm địa chỉ mới
                                        </button>
                                    )}
                                </div>

                                {/* Address List */}
                                {addresses.length > 0 && !showAddNew && (
                                    <div className="space-y-3">
                                        {addresses.map((addr) => (
                                            <button
                                                key={addr.id}
                                                onClick={() => setSelectedAddressId(addr.id)}
                                                className={`w-full p-4 rounded-xl text-left transition-all cursor-pointer ${selectedAddressId === addr.id
                                                    ? 'bg-white/10 border-2 border-white/30'
                                                    : 'bg-[#2D2D2F] border-2 border-transparent hover:border-white/10'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-white font-medium">{addr.full_name}</span>
                                                            <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/60">
                                                                {addr.label}
                                                            </span>
                                                            {addr.is_default && (
                                                                <span className="px-2 py-0.5 bg-green-500/20 rounded text-xs text-green-400">
                                                                    Mặc định
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-white/60 text-sm">{addr.phone}</p>
                                                        <p className="text-white/50 text-sm mt-1">
                                                            {addr.address_line}
                                                            {addr.ward && `, ${addr.ward}`}
                                                            {addr.district && `, ${addr.district}`}
                                                            , {addr.province}
                                                        </p>
                                                    </div>
                                                    {selectedAddressId === addr.id && (
                                                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Add New Address Form */}
                                {showAddNew && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label="Họ tên"
                                                placeholder="Nhập họ tên người nhận"
                                                value={newAddress.full_name}
                                                onChange={(e) => setNewAddress(prev => ({ ...prev, full_name: e.target.value }))}
                                            />
                                            <Input
                                                label="Số điện thoại"
                                                placeholder="Nhập số điện thoại"
                                                value={newAddress.phone}
                                                onChange={(e) => setNewAddress(prev => ({ ...prev, phone: e.target.value }))}
                                            />
                                        </div>
                                        <Input
                                            label="Địa chỉ"
                                            placeholder="Số nhà, đường, phường/xã, quận/huyện"
                                            value={newAddress.address_line}
                                            onChange={(e) => setNewAddress(prev => ({ ...prev, address_line: e.target.value }))}
                                        />
                                        <Input
                                            label="Tỉnh/Thành phố"
                                            placeholder="Nhập tỉnh/thành phố"
                                            value={newAddress.province}
                                            onChange={(e) => setNewAddress(prev => ({ ...prev, province: e.target.value }))}
                                        />
                                        <div className="flex gap-3">
                                            <Button
                                                variant="primary"
                                                onClick={handleAddNewAddress}
                                                disabled={saving}
                                            >
                                                {saving ? 'Đang lưu...' : 'Lưu địa chỉ'}
                                            </Button>
                                            {addresses.length > 0 && (
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => setShowAddNew(false)}
                                                >
                                                    Hủy
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </AnimatedSection>

                        {/* Note */}
                        <AnimatedSection delay={0.2}>
                            <div className="bg-[#1D1D1F] rounded-3xl p-8">
                                <h2 className="text-xl font-semibold text-white mb-4">
                                    Ghi Chú
                                </h2>
                                <textarea
                                    placeholder="Ghi chú cho đơn hàng (tùy chọn)"
                                    className="w-full p-4 bg-[#2D2D2F] rounded-xl text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-[#0071E3] border border-white/5"
                                    rows={3}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                />
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

                                {/* Grouped Items */}
                                <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto">
                                    {/* Products */}
                                    {productItems.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <ProductIcon />
                                                <span className="text-white/70 text-sm font-medium">Sản phẩm</span>
                                            </div>
                                            {productItems.map((item) => (
                                                <OrderItem key={item.id} item={item} />
                                            ))}
                                        </div>
                                    )}

                                    {/* 3D Prints */}
                                    {printItems.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <PrintIcon />
                                                <span className="text-white/70 text-sm font-medium">In 3D</span>
                                            </div>
                                            {printItems.map((item) => (
                                                <OrderItem key={item.id} item={item} />
                                            ))}
                                        </div>
                                    )}

                                    {/* Custom */}
                                    {customItems.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <CustomIcon />
                                                <span className="text-white/70 text-sm font-medium">Custom</span>
                                            </div>
                                            {customItems.map((item) => (
                                                <OrderItem key={item.id} item={item} />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Totals */}
                                <div className="border-t border-white/10 pt-4 space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Tạm tính</span>
                                        <span className="text-white">{totalPrice.toLocaleString('vi-VN')}đ</span>
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
                                <div className="mt-4 p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-white/70 text-sm">Thanh toán ngay (50%)</span>
                                        <span className="text-xl font-bold text-white">
                                            {deposit.toLocaleString('vi-VN')}đ
                                        </span>
                                    </div>
                                    <p className="text-white/40 text-xs mt-1">
                                        Còn lại thanh toán khi nhận hàng
                                    </p>
                                </div>

                                <Button
                                    variant="primary"
                                    size="lg"
                                    className="w-full mt-6"
                                    onClick={handleCheckout}
                                    disabled={!selectedAddressId || submitting}
                                >
                                    {submitting ? 'Đang xử lý...' : 'Xác nhận đặt hàng'}
                                </Button>

                                <p className="text-white/40 text-xs text-center mt-4">
                                    Bằng việc đặt hàng, bạn đồng ý với{' '}
                                    <Link href="/terms" className="text-white/70">Điều khoản dịch vụ</Link>
                                </p>
                            </div>
                        </AnimatedSection>
                    </div>
                </div>
            </div>
        </div>
    );
}
