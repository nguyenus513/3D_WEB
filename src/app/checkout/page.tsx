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
function OrderItem({ item }: { item: CartItem | any }) {
    const getTypeIcon = () => {
        // Handle both CartItem type and DB Order Item type
        const type = item.type || item.order_type;
        switch (type) {
            case 'product': return <ProductIcon />;
            case 'print': return <PrintIcon />;
            case 'custom': return <CustomIcon />;
            default: return <ProductIcon />;
        }
    };

    return (
        <div className="flex justify-between items-start py-3 border-b border-white/10 last:border-b-0">
            <div className="flex items-start gap-3 flex-1">
                <span className="text-white/50 mt-0.5">{getTypeIcon()}</span>
                <div>
                    <p className="text-white font-medium line-clamp-1">{item.name || item.product_name || 'Sản phẩm'}</p>
                    <div className="text-white/50 text-sm">
                        {/* Render details based on type */}
                        {item.size && <span>Size: {item.size} • </span>}
                        {item.quantity && <span>SL: {item.quantity}</span>}
                    </div>
                </div>
            </div>
            <p className="text-white font-medium whitespace-nowrap">
                {((item.price || item.total || 0) * (item.quantity || 1)).toLocaleString('vi-VN')}đ
            </p>
        </div>
    );
}

export function CheckoutContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderIdParam = searchParams.get('orderId');

    // Cart Data
    const { items, totalPrice: cartTotal, clearCart } = useCart();
    const { data: session } = useSession();

    // State
    // State
    // State
    const [loading, setLoading] = useState(true);
    const [singleOrder, setSingleOrder] = useState<any | null>(null);
    const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
    const [isAddressValid, setIsAddressValid] = useState(false);
    const [paymentConfig, setPaymentConfig] = useState<any>(null);

    // Derived State
    const mode = orderIdParam ? 'single' : 'cart';
    const currentItems = mode === 'single' ? (singleOrder ? [singleOrder] : []) : items;

    // Totals Calculation
    const subtotal = mode === 'single'
        ? (singleOrder?.total || 0)  // Single order usually already includes price logic
        : cartTotal;

    // Shipping Fee Logic (FREE SHIPPING requested)
    const shippingFee = 0;
    const finalTotal = subtotal + shippingFee;

    // QR Code Logic - 18 Char Hex Format [10 cust][8 parent]
    const qrTransferContent = useMemo(() => {
        // 1. Get Customer Code (10 hex) or use placeholder
        let custCode = paymentConfig?.customer_code;

        // Clean and validate Customer Code
        if (custCode) {
            custCode = custCode.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
            if (custCode.length < 10) custCode = custCode.padEnd(10, '0');
            else if (custCode.length > 10) custCode = custCode.substring(0, 10);
        } else {
            // Default placeholder if not logged in or config not loaded yet
            custCode = '0000000000';
        }

        // 2. Get Parent Code (8 hex)
        let parentCode = '';

        if (mode === 'single' && singleOrder) {
            // Existing Order: Extract parent code from order_code
            const rawCode = singleOrder.order_code || singleOrder.id;
            const cleanCode = rawCode.toString().replace(/[^a-fA-F0-9]/g, '').toUpperCase();
            // If child code (16), take first 8. If parent (8), take 8.
            parentCode = cleanCode.substring(0, 8).padEnd(8, '0');
        } else {
            // Cart: Generate new random 8 hex
            parentCode = Math.random().toString(16).substring(2, 10).toUpperCase().padEnd(8, '0');
        }

        return `${custCode}${parentCode}`;
    }, [mode, singleOrder, paymentConfig]);

    // Fetch Payment Config
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

    // Fetch Single Order if needed
    useEffect(() => {
        if (mode === 'single' && orderIdParam) {
            setLoading(true);
            const fetchOrder = async () => {
                try {
                    // Use API route instead of direct Supabase query
                    const res = await fetch(`/api/orders/${orderIdParam}`);
                    if (res.ok) {
                        const data = await res.json();
                        // Normalize single order to look like an item
                        setSingleOrder({
                            ...data,
                            name: `Đơn hàng ${data.order_code}`,
                            type: data.order_type,
                            price: data.subtotal, // Use subtotal as base price
                            quantity: 1
                        });
                        // Pre-fill address if order has it
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

    // Handle Address Change
    const handleAddressChange = (address: ShippingAddress) => {
        setShippingAddress(address);
        // Basic validation
        const isValid = !!(address.full_name && address.phone && address.address_line && address.province);
        setIsAddressValid(isValid);

        // If in Single Order mode, update the order's address in DB via API
        if (mode === 'single' && orderIdParam && isValid) {
            updateOrderAddress(orderIdParam, address);
        }
    };

    const updateOrderAddress = async (id: string, address: ShippingAddress) => {
        // Update order address via API
        await fetch(`/api/orders/${id}/update-address`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shipping_address: address,
                shipping_fee: 0,
                total: singleOrder?.subtotal || 0,
            }),
        });
    };

    // Handle Payment Confirmation (Cart Mode)
    // Handle Payment Confirmation (Cart Mode)
    const handleCartPayment = async () => {
        if (!shippingAddress || !isAddressValid) {
            alert('Vui lòng chọn địa chỉ giao hàng hợp lệ');
            return;
        }

        // Validate address length strictly to match backend schema
        if ((shippingAddress.address_line || '').length < 5) {
            alert('Địa chỉ giao hàng quá ngắn. Vui lòng nhập chi tiết hơn (tối thiểu 5 ký tự).');
            return;
        }

        try {
            // 1. Create Order
            const createRes = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: items.map(item => ({
                        // Use productId (UUID) from DB, fallback to item.id if missing (though item.id is likely not UUID)
                        // If productId is missing for custom items, Backend validation might fail if it requires valid UUID product_id.
                        product_id: item.productId || item.id,
                        quantity: item.quantity,
                        price: item.price,
                        customization: (item as any).customization || {}
                    })),
                    // Map to CreateOrderSchema: { name, phone, address, city }
                    shipping_address: {
                        name: shippingAddress.full_name,
                        phone: shippingAddress.phone,
                        address: shippingAddress.address_line || '',
                        city: shippingAddress.province || ''
                    },
                    payment_method: 'bank_transfer', // Schema requires 'bank_transfer', not 'QR_TRANSFER'
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

            // 2. Confirm Payment immediately (since user clicked "I Paid")
            const confirmRes = await fetch(`/api/orders/${newOrder.id}/payment-confirmation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!confirmRes.ok) {
                // If confirmation fails but order created, we still proceed but warn?
                console.error('Payment confirmation failed for new order:', newOrder.id);
            }

            // 3. Success
            clearCart();
            // Redirect to order history or success page
            router.push('/account/orders');
        } catch (error) {
            console.error('Checkout failed details:', error);
            // Display clean error message to user
            let userMsg = (error as Error).message;
            if (userMsg.includes('[')) { // Determine if it's stringified JSON
                try {
                    const parsed = JSON.parse(userMsg);
                    // If Zod error array, show first message
                    if (Array.isArray(parsed)) userMsg = parsed[0]?.message || 'Dữ liệu không hợp lệ';
                } catch { }
            }
            alert(`Lỗi: ${userMsg}`);
            throw error; // Re-throw to let PaymentQR know it failed (if it handled state)
        }
    };

    if (loading) return (
        <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
    );

    if (mode === 'cart' && items.length === 0) {
        return (
            <div className="min-h-screen pt-24 pb-12 text-center">
                <h1 className="text-2xl text-white mb-4">Giỏ hàng trống</h1>
                <Link href="/products" className="text-blue-400 hover:underline">Tiếp tục mua sắm</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 md:px-6">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Info & Address */}
                <div className="lg:col-span-2 space-y-6">
                    <AnimatedSection>
                        <h1 className="text-2xl font-bold text-white mb-6">Thanh Toán</h1>

                        {/* Address Selector */}
                        <div className="bg-[#1D1D1F] rounded-3xl p-6 border border-white/10">
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs">1</span>
                                Địa chỉ nhận hàng
                            </h2>
                            <AddressSelector
                                userId={session?.user?.id}
                                value={shippingAddress}
                                onChange={handleAddressChange}
                            />
                        </div>

                        {/* Order Items */}
                        <div className="bg-[#1D1D1F] rounded-3xl p-6 border border-white/10 mt-6">
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-xs">2</span>
                                Đơn hàng
                            </h2>
                            <div className="space-y-1">
                                {currentItems.map((item, i) => (
                                    <OrderItem key={i} item={item} />
                                ))}
                            </div>
                        </div>
                    </AnimatedSection>
                </div>

                {/* Right Column: Payment & QR */}
                <div className="lg:col-span-1">
                    <div className="sticky top-24 space-y-6">
                        {/* Summary */}
                        <div className="bg-[#1D1D1F] rounded-3xl p-6 border border-white/10">
                            <h3 className="text-lg font-semibold text-white mb-4">Tổng cộng</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between text-white/60">
                                    <span>Tạm tính</span>
                                    <span>{subtotal.toLocaleString('vi-VN')}đ</span>
                                </div>
                                {/* Removed Shipping Fee Line */}
                                <div className="pt-3 border-t border-white/10 flex justify-between items-end">
                                    <span className="text-white font-medium">Thành tiền</span>
                                    <span className="text-2xl font-bold text-green-400">
                                        {finalTotal.toLocaleString('vi-VN')}đ
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* QR Code Section - Enabled only when address valid */}
                        <AnimatePresence>
                            {isAddressValid && paymentConfig?.account_no ? (
                                <motion.div
                                    key="payment-qr"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <PaymentQR
                                        orderId={mode === 'single' ? orderIdParam! : 'cart-placeholder'}
                                        orderCode={qrTransferContent}
                                        transferContent={qrTransferContent}
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
                                <div className="bg-white/5 rounded-3xl p-8 text-center border border-white/10 border-dashed">
                                    <p className="text-white/50">Vui lòng nhập địa chỉ giao hàng để hiển thị mã QR thanh toán</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Wrap in Suspense for useSearchParams
export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    );
}
