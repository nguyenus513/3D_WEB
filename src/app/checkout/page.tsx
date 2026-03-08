'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { AnimatedSection } from '@/components/ui/Animations';
import { useCart, CartItem } from '@/lib/store/cart';
import { AddressSelector, ShippingAddress } from '@/components/checkout/AddressSelector';
import { PaymentQR } from '@/components/PaymentQR';
import { Box, Boxes, PenLine } from 'lucide-react';

function OrderItem({ item, onUpdateNotes }: { item: CartItem | any; onUpdateNotes?: (id: string, notes: string) => void }) {
    const getTypeIcon = () => {
        const type = item.type || item.order_type;
        switch (type) {
            case 'product': return <Box size={20} strokeWidth={1.5} />;
            case 'print': return <Boxes size={20} strokeWidth={1.5} />;
            case 'custom': return <PenLine size={20} strokeWidth={1.5} />;
            default: return <Box size={20} strokeWidth={1.5} />;
        }
    };

    return (
        <div className="py-3 border-b border-[var(--border-color)] last:border-b-0">
            <div className="flex justify-between items-start">
                <div className="flex items-start gap-3 flex-1">
                    <span className="text-[var(--text-secondary)] mt-0.5">{getTypeIcon()}</span>
                    <div>
                        <p className="text-[var(--text-primary)] font-medium line-clamp-1">{item.name || item.product_name || 'Sản phẩm'}</p>
                        <div className="text-[var(--text-secondary)] text-sm">
                            {item.size && <span>Size: {item.size} • </span>}
                            {item.quantity && <span>SL: {item.quantity}</span>}
                        </div>
                    </div>
                </div>
                <p className="text-[var(--text-primary)] font-medium whitespace-nowrap">
                    {((item.price || item.total || 0) * (item.quantity || 1)).toLocaleString('vi-VN')}đ
                </p>
            </div>
            {onUpdateNotes ? (
                <div className="mt-3 ml-8">
                    <textarea
                        value={item.notes || ''}
                        onChange={(e) => onUpdateNotes(item.id, e.target.value)}
                        placeholder="Ghi chú (tùy chọn)..."
                        className="w-full bg-[var(--material-glass)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm resize-none focus:outline-none focus:border-[var(--border-color)]"
                        rows={2}
                    />
                </div>
            ) : item.notes ? (
                <div className="mt-2 ml-8 text-sm text-[var(--text-secondary)] bg-[var(--material-glass)] rounded-lg px-3 py-2">
                    <span className="text-[var(--text-tertiary)]">Ghi chú:</span> {item.notes}
                </div>
            ) : null}
        </div>
    );
}

export function CheckoutContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderIdParam = searchParams.get('orderId');

    const { items, totalPrice: cartTotal, clearCart, updateItem } = useCart();
    const { data: session } = useSession();

    const [loading, setLoading] = useState(true);
    const [singleOrder, setSingleOrder] = useState<any | null>(null);
    const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
    const [isAddressValid, setIsAddressValid] = useState(false);
    const [paymentConfig, setPaymentConfig] = useState<any>(null);

    const mode = orderIdParam ? 'single' : 'cart';
    const currentItems = mode === 'single' ? (singleOrder ? [singleOrder] : []) : items;

    const subtotal = mode === 'single'
        ? (singleOrder?.total || 0)
        : cartTotal;

    const finalTotal = subtotal;

    const cartCode = useMemo(() => {
        if (mode === 'single' && singleOrder) {
            if (singleOrder.cart_code) {
                return singleOrder.cart_code.toUpperCase();
            }
            const rawCode = singleOrder.order_code || singleOrder.id;
            const cleanCode = rawCode.toString().replace(/[^a-fA-F0-9]/g, '').toUpperCase();
            return cleanCode.substring(0, 8).padEnd(8, '0');
        } else {
            return Math.random().toString(16).substring(2, 10).toUpperCase().padEnd(8, '0');
        }
    }, [mode, singleOrder]);

    useEffect(() => {
        const fetchPaymentConfig = async () => {
            try {
                const res = await fetch('/api/payment-config');
                if (res.ok) {
                    const data = await res.json();
                    setPaymentConfig(data);
                }
            } catch (error) {
                console.error('Error fetching payment config:', error);
            }
        };
        fetchPaymentConfig();
    }, []);

    useEffect(() => {
        if (mode === 'single' && orderIdParam) {
            setLoading(true);
            const fetchOrder = async () => {
                try {
                    const res = await fetch(`/api/orders/${orderIdParam}`);
                    if (res.ok) {
                        const data = await res.json();
                        setSingleOrder({
                            ...data,
                            name: `Đơn hàng ${data.order_code}`,
                            type: data.order_type,
                            price: data.subtotal,
                            quantity: 1
                        });
                        if (data.shipping_address) {
                            setShippingAddress(data.shipping_address);
                            setIsAddressValid(true);
                        }
                    } else {
                        console.error('Order not found');
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            };
            fetchOrder();
        } else {
            setLoading(false);
        }
    }, [orderIdParam, mode]);

    const handleAddressChange = (address: ShippingAddress) => {
        setShippingAddress(address);
        const isValid = !!(address.full_name && address.phone && address.address_line && address.province);
        setIsAddressValid(isValid);

        if (mode === 'single' && orderIdParam && isValid) {
            updateOrderAddress(orderIdParam, address);
        }
    };

    const updateOrderAddress = async (id: string, address: ShippingAddress) => {
        await fetch(`/api/orders/${id}/update-address`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shipping_address: address,
                total: singleOrder?.subtotal || 0,
            }),
        });
    };

    const handleCartPayment = async () => {
        if (!shippingAddress || !isAddressValid) {
            alert('Vui lòng chọn địa chỉ giao hàng hợp lệ');
            return;
        }

        if ((shippingAddress.address_line || '').length < 5) {
            alert('Địa chỉ giao hàng quá ngắn. Vui lòng nhập chi tiết hơn (tối thiểu 5 ký tự).');
            return;
        }

        try {
            const createRes = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: items.map(item => ({
                        product_id: item.productId || null,
                        product_name: item.name,
                        quantity: item.quantity,
                        price: item.price,
                        size: item.size || null,
                        item_type: item.type,
                        customization: {
                            ...((item as any).customization || {}),
                            size: item.size,
                            sku: item.sku,
                            printOptions: item.printOptions,
                            notes: item.notes,
                        }
                    })),
                    shipping_address: {
                        name: shippingAddress.full_name,
                        phone: shippingAddress.phone,
                        address: shippingAddress.address_line || '',
                        ward: shippingAddress.ward || '',
                        district: shippingAddress.district || '',
                        city: shippingAddress.province || '',
                        full_name: shippingAddress.full_name,
                        address_line: shippingAddress.address_line || '',
                        province: shippingAddress.province || '',
                    },
                    payment_method: 'bank_transfer',
                    notes: ''
                })
            });

            if (!createRes.ok) {
                const errData = await createRes.json();
                console.error('API Error Response:', JSON.stringify(errData, null, 2));
                const errMsg = typeof errData.error === 'object'
                    ? JSON.stringify(errData.error)
                    : (errData.error || 'Không thể tạo đơn hàng');
                throw new Error(errMsg);
            }

            const { data: newOrder } = await createRes.json();

            const confirmRes = await fetch(`/api/orders/${newOrder.id}/payment-confirmation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!confirmRes.ok) {
                console.error('Payment confirmation failed for new order:', newOrder.id);
            }

            clearCart();
            router.push('/account/orders');
        } catch (error) {
            console.error('Checkout failed details:', error);
            let userMsg = (error as Error).message;
            if (userMsg.includes('[')) {
                try {
                    const parsed = JSON.parse(userMsg);
                    if (Array.isArray(parsed)) userMsg = parsed[0]?.message || 'Dữ liệu không hợp lệ';
                } catch { }
            }
            alert(`Lỗi: ${userMsg}`);
            throw error;
        }
    };

    if (loading) return (
        <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-white rounded-full animate-spin" />
        </div>
    );

    if (mode === 'cart' && items.length === 0) {
        return (
            <div className="min-h-screen pt-24 pb-12 text-center">
                <h1 className="text-2xl text-[var(--text-primary)] mb-4">Giỏ hàng trống</h1>
                <Link href="/products" className="text-blue-400 hover:underline">Tiếp tục mua sắm</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 md:px-6">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

                <div className="lg:col-span-2 space-y-6">
                    <AnimatedSection>
                        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Thanh Toán</h1>

                        <div className="bg-[var(--material-panel)] rounded-3xl p-6 border border-[var(--border-color)]">
                            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs">1</span>
                                Địa chỉ nhận hàng
                            </h2>
                            <AddressSelector
                                userId={session?.user?.id}
                                value={shippingAddress}
                                onChange={handleAddressChange}
                            />
                        </div>

                        <div className="bg-[var(--material-panel)] rounded-3xl p-6 border border-[var(--border-color)] mt-6">
                            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-xs">2</span>
                                Đơn hàng
                            </h2>
                            <div className="space-y-1">
                                {currentItems.map((item, i) => (
                                    <OrderItem
                                        key={i}
                                        item={item}
                                        onUpdateNotes={mode === 'cart' ? (id, notes) => updateItem(id, { notes }) : undefined}
                                    />
                                ))}
                            </div>
                        </div>
                    </AnimatedSection>
                </div>

                <div className="lg:col-span-1">
                    <div className="sticky top-24 space-y-6">
                        <div className="bg-[var(--material-panel)] rounded-3xl p-6 border border-[var(--border-color)]">
                            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Tổng cộng</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between text-[var(--text-secondary)]">
                                    <span>Tạm tính</span>
                                    <span>{subtotal.toLocaleString('vi-VN')}đ</span>
                                </div>
                                <div className="pt-3 border-t border-[var(--border-color)] flex justify-between items-end">
                                    <span className="text-[var(--text-primary)] font-medium">Thành tiền</span>
                                    <span className="text-2xl font-bold text-green-400">
                                        {finalTotal.toLocaleString('vi-VN')}đ
                                    </span>
                                </div>
                            </div>
                        </div>

                        <AnimatePresence>
                            {isAddressValid && paymentConfig?.account_no ? (
                                <motion.div
                                    key="payment-qr"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <PaymentQR
                                        orderId={mode === 'single' ? orderIdParam! : 'cart-placeholder'}
                                        orderCode={singleOrder?.order_code || cartCode}
                                        cartCode={cartCode}
                                        transferContent={cartCode}
                                        amount={finalTotal}
                                        bankId={paymentConfig.bank_code}
                                        accountNo={paymentConfig.account_no}
                                        accountName={paymentConfig.account_name}
                                        onPaymentConfirmed={mode === 'cart' ? handleCartPayment : undefined}
                                    />
                                </motion.div>
                            ) : isAddressValid && !paymentConfig?.account_no ? (
                                <div className="bg-red-500/10 rounded-3xl p-8 text-center border border-red-500/30">
                                    <p className="text-red-400">Lỗi cấu hình thanh toán. Vui lòng liên hệ admin.</p>
                                </div>
                            ) : (
                                <div className="bg-[var(--material-glass)] rounded-3xl p-8 text-center border border-[var(--border-color)] border-dashed">
                                    <p className="text-[var(--text-secondary)]">Vui lòng nhập địa chỉ giao hàng để hiển thị mã QR thanh toán</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-white rounded-full animate-spin" />
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    );
}
