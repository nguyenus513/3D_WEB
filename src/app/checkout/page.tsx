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
import { getSupabase } from '@/lib/supabase/client';

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

function CheckoutContent() {
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
        if (mode === 'single' && singleOrder) {
            // For existing order, strip non-hex chars to be safe, or just return as is if trusted
            // User requested "max ddown khoong cos USR-"
            const rawCode = singleOrder.order_code || singleOrder.id;
            return rawCode.toString().replace(/[^a-fA-F0-9]/g, '').toUpperCase();
        }

        // For Cart: Construct 18-char hex string
        // 1. Get Customer Code (10 hex) or generate fallback
        let custCode = paymentConfig?.customer_code;

        // Strip "USR-" or any non-hex prefix if it exists
        if (custCode) {
            custCode = custCode.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
            // If it becomes too short or empty, fallback?
            // Assuming DB has correct 10-char hex from previous migration
            // If it's 8 chars (from old generateId), pad it?
            if (custCode.length < 10) {
                custCode = custCode.padEnd(10, '0');
            } else if (custCode.length > 10) {
                custCode = custCode.substring(0, 10);
            }
        }

        if (!custCode) {
            // Fallback for guest: 10 random hex chars
            // In reality, this should match the user's DB code once logged in
            custCode = '0000000000'; // Default placeholder if waiting
        }

        // 2. Generate Random 8 Hex for "Parent Order" (Cart Session)
        // We memoize this so it doesn't change on every render
        const random8Hex = Math.random().toString(16).substring(2, 10).toUpperCase().padEnd(8, '0');

        return `${custCode}${random8Hex}`;
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
                    const supabase = getSupabase();
                    const { data, error } = await supabase
                        .from('orders')
                        .select('*')
                        .eq('id', orderIdParam)
                        .single();

                    if (data) {
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
                        console.error('Order not found', error);
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

        // If in Single Order mode, update the order's address in DB immediately?
        // Or wait? Better to update so Admin sees it.
        if (mode === 'single' && orderIdParam && isValid) {
            updateOrderAddress(orderIdParam, address);
        }
    };

    const updateOrderAddress = async (id: string, address: ShippingAddress) => {
        const supabase = getSupabase();
        await supabase.from('orders').update({
            shipping_address: address,
            shipping_fee: 0, // Free shipping
            total: (singleOrder?.subtotal || 0) // Recalculate total with 0 shipping
        }).eq('id', id);
    };

    // Handle Payment Confirmation (Cart Mode)
    const handleCartPayment = async () => {
        // ... (existing comments)
        console.log("Cart Payment logic would go here if PaymentQR allows custom handler");
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
                            {isAddressValid ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <PaymentQR
                                        orderId={mode === 'single' ? orderIdParam! : 'cart-placeholder'}
                                        orderCode={qrTransferContent}
                                        transferContent={qrTransferContent}
                                        amount={finalTotal}
                                        bankId={paymentConfig?.bank_code || 'MB'}
                                        accountNo={paymentConfig?.account_no || '0336668386'}
                                        accountName={paymentConfig?.account_name || 'NGUYEN MINH NHAT'}
                                        onPaymentConfirmed={() => {
                                            if (mode === 'cart') clearCart();
                                            // Optional: Redirect to success
                                            // router.push('/checkout/success/...')
                                        }}
                                    />
                                </motion.div>
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
