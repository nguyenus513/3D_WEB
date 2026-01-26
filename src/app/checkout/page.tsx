'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCart } from '@/lib/store/cart';
import { getSupabase } from '@/lib/supabase/client';

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

export default function CheckoutPage() {
    const router = useRouter();
    const { items, totalPrice } = useCart();
    const { data: session, status } = useSession();

    const [loading, setLoading] = useState(true);
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

        // Get user from API to avoid RLS 401
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

        // Load saved addresses via API
        try {
            const res = await fetch('/api/addresses');
            if (res.ok) {
                const data = await res.json();
                const addressList = data.addresses || [];
                if (addressList.length > 0) {
                    setAddresses(addressList);
                    // Select default or first address
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

    const handleCheckout = () => {
        console.log('=== CHECKOUT START ===');
        console.log('selectedAddressId:', selectedAddressId);
        console.log('items:', items);
        console.log('totalPrice:', totalPrice);

        if (!selectedAddressId) {
            console.log('NO ADDRESS SELECTED - ABORT');
            return;
        }

        // Store selected address and note in sessionStorage for payment page
        const selectedAddress = addresses.find(a => a.id === selectedAddressId);
        sessionStorage.setItem('checkout_address', JSON.stringify(selectedAddress));
        sessionStorage.setItem('checkout_note', note);

        // Store cart items and total for payment page (fixes hydration issue)
        sessionStorage.setItem('checkout_items', JSON.stringify(items));
        sessionStorage.setItem('checkout_total', totalPrice.toString());

        console.log('Saved to sessionStorage:');
        console.log('- checkout_items:', sessionStorage.getItem('checkout_items'));
        console.log('- checkout_total:', sessionStorage.getItem('checkout_total'));
        console.log('Navigating to /checkout/payment...');

        router.push('/checkout/payment');
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
                                            className="text-sm text-blue-400 hover:text-blue-300"
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
                                                className={`w-full p-4 rounded-xl text-left transition-all ${selectedAddressId === addr.id
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

                                {/* Items */}
                                <div className="space-y-4 mb-6">
                                    {items.map((item) => (
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
                                    disabled={!selectedAddressId}
                                >
                                    Tiếp tục thanh toán
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
