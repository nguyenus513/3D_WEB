'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { AnimatedSection } from '@/components/ui/Animations';
import { useCart, CartItem } from '@/lib/store/cart';
import { AddressSelector, ShippingAddress } from '@/components/checkout/AddressSelector';
import { PaymentQR } from '@/components/PaymentQR';
import { addCsrfToRequest } from '@/lib/security/csrf-client';

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

type CartPaymentSession = {
    orderId: string;
    orderCode: string;
    customerCode?: string;
    totalAmount: number;
    totalQrUrl?: string;
    totalTransferContent?: string;
    bankInfo?: {
        bankCode: string;
        accountNo: string;
        accountName: string;
        bankName?: string;
    };
};

// Item row in order summary
function OrderItem({ item }: { item: CartItem | any }) {
    const getTypeIcon = () => {
        const rawType = item.type || item.order_type;
        const type = rawType === 'ready_made' ? 'product' : rawType === 'printing' ? 'print' : rawType;
        switch (type) {
            case 'product': return <ProductIcon />;
            case 'print': return <PrintIcon />;
            case 'custom': return <CustomIcon />;
            default: return <ProductIcon />;
        }
    };

    const quantity = Number(item.quantity ?? 1);
    const unitPrice = Number(item.unit_price ?? item.price ?? item.total ?? item.total_price ?? 0);
    const total = Number(item.total_price ?? unitPrice * quantity);
    const size = item.size || item.configuration?.size;
    const name = item.name || item.product_name || item.product?.name || 'Sản phẩm';

    return (
        <div className="flex justify-between items-start py-3 border-b border-white/10 last:border-b-0">
            <div className="flex items-start gap-3 flex-1">
                <span className="text-white/50 mt-0.5">{getTypeIcon()}</span>
                <div>
                    <p className="text-white font-medium line-clamp-1">{name}</p>
                    <div className="text-white/50 text-sm">
                        {size && <span>Size: {size} • </span>}
                        {quantity && <span>SL: {quantity}</span>}
                    </div>
                </div>
            </div>
            <p className="text-white font-medium whitespace-nowrap">
                {total.toLocaleString('vi-VN')}đ
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

    const [loading, setLoading] = useState(true);
    const [singleOrder, setSingleOrder] = useState<any | null>(null);
    const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
    const [isAddressValid, setIsAddressValid] = useState(false);
    const [paymentSession, setPaymentSession] = useState<CartPaymentSession | null>(null);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [creatingPayment, setCreatingPayment] = useState(false);

    const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
    const lastAddressHashRef = useRef<string | null>(null);

    // Derived State
    const mode = orderIdParam ? 'single' : 'cart';

    const currentItems = useMemo(() => {
        if (mode !== 'single') return items;
        if (!singleOrder) return [];

        const fallbackType = singleOrder.order_type === 'printing'
            ? 'print'
            : singleOrder.order_type === 'custom'
                ? 'custom'
                : 'product';

        const orderItems = Array.isArray(singleOrder.items) ? singleOrder.items : [];
        if (orderItems.length === 0) {
            return [
                {
                    ...singleOrder,
                    type: fallbackType,
                    name: singleOrder.name || `Đơn hàng ${singleOrder.order_code}`,
                    quantity: 1,
                    unit_price: singleOrder.total_amount ?? singleOrder.total ?? 0,
                    total_price: singleOrder.total_amount ?? singleOrder.total ?? 0,
                },
            ];
        }

        return orderItems.map((item: any) => ({
            ...item,
            type: item.type || fallbackType,
        }));
    }, [mode, items, singleOrder]);

    // Totals Calculation
    const subtotal = mode === 'single'
        ? Number(singleOrder?.total_amount ?? singleOrder?.total ?? 0)
        : cartTotal;

    const shippingFee = 0;
    const finalTotal = subtotal + shippingFee;

    // Fetch Single Order if needed
    useEffect(() => {
        if (mode === 'single' && orderIdParam) {
            setLoading(true);
            const fetchOrder = async () => {
                try {
                    const res = await fetch(`/api/orders/lookup?id=${orderIdParam}`, { cache: 'no-store' });
                    const payload = await res.json();
                    if (res.ok && payload?.success && payload?.data) {
                        const data = payload.data;
                        setSingleOrder(data);
                        if (data.shipping_address) {
                            setShippingAddress(data.shipping_address);
                            const isValid = !!(
                                data.shipping_address.full_name &&
                                data.shipping_address.phone &&
                                data.shipping_address.address_line &&
                                data.shipping_address.province &&
                                data.shipping_address.district
                            );
                            setIsAddressValid(isValid);
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
        const isValid = !!(
            address.full_name &&
            address.phone &&
            address.address_line &&
            address.province &&
            address.district
        );
        setIsAddressValid(isValid);
    };

    const updateOrderAddress = async (id: string, address: ShippingAddress, amount: number) => {
        await fetch(`/api/orders/${id}/update-address`, {
            method: 'PATCH',
            headers: addCsrfToRequest({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                shipping_address: address,
                shipping_fee: 0,
                total_amount: amount,
            }),
        });
    };

    // Update address for single order
    useEffect(() => {
        if (mode !== 'single' || !orderIdParam || !shippingAddress || !isAddressValid) return;
        const fingerprint = `${orderIdParam}:${JSON.stringify(shippingAddress)}`;
        if (lastAddressHashRef.current === fingerprint) return;
        lastAddressHashRef.current = fingerprint;
        updateOrderAddress(orderIdParam, shippingAddress, subtotal);
    }, [mode, orderIdParam, shippingAddress, isAddressValid, subtotal]);

    // Create cart payment session when address is valid
    useEffect(() => {
        if (mode !== 'cart') return;
        if (!shippingAddress || !isAddressValid) return;
        if (items.length === 0) return;
        if (paymentSession?.orderId || creatingPayment) return;

        const createCartPayment = async () => {
            setCreatingPayment(true);
            setPaymentError(null);

            try {
                const cartItems = items.map((item) => ({
                    productId: item.productId,
                    productName: item.name,
                    productType: item.type === 'print' ? 'printing' : item.type,
                    productSku: item.sku,
                    quantity: item.quantity,
                    unitPrice: item.price,
                    metadata: {
                        size: item.size,
                        sku: item.sku,
                        image: item.image,
                        printOptions: item.printOptions,
                        printFiles: item.printFiles,
                        description: item.description,
                        customFiles: item.customFiles,
                    },
                }));

                const res = await fetch('/api/payments/cart', {
                    method: 'POST',
                    headers: addCsrfToRequest({
                        'Content-Type': 'application/json',
                        'Idempotency-Key': idempotencyKeyRef.current,
                    }),
                    body: JSON.stringify({
                        items: cartItems,
                        shippingAddress: shippingAddress,
                        note: '',
                    }),
                });

                const payload = await res.json();
                if (!res.ok || !payload?.success) {
                    const msg = payload?.error?.message || 'Unable to create payment session';
                    setPaymentError(msg);
                    return;
                }

                setPaymentSession(payload.data);
            } catch (error) {
                console.error('Create cart payment error:', error);
                setPaymentError('Unable to create payment session');
            } finally {
                setCreatingPayment(false);
            }
        };

        createCartPayment();
    }, [mode, shippingAddress, isAddressValid, items, paymentSession, creatingPayment]);

    // Update address after cart order created
    useEffect(() => {
        if (mode !== 'cart') return;
        if (!paymentSession?.orderId || !shippingAddress || !isAddressValid) return;
        const fingerprint = `${paymentSession.orderId}:${JSON.stringify(shippingAddress)}`;
        if (lastAddressHashRef.current === fingerprint) return;
        lastAddressHashRef.current = fingerprint;
        updateOrderAddress(paymentSession.orderId, shippingAddress, finalTotal);
    }, [mode, paymentSession?.orderId, shippingAddress, isAddressValid, finalTotal]);

    const handlePaymentConfirmed = async (orderId: string, orderCode: string, shouldClearCart: boolean) => {
        try {
            const res = await fetch(`/api/orders/${orderId}/payment-confirmation`, {
                method: 'POST',
                headers: addCsrfToRequest({ 'Content-Type': 'application/json' }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Unable to confirm payment');
            }

            if (shouldClearCart) clearCart();
            router.push(`/checkout/success/${orderCode}`);
        } catch (error) {
            console.error('Checkout failed details:', error);
            const userMsg = error instanceof Error ? error.message : 'Unable to confirm payment';
            alert(`Error: ${userMsg}`);
            throw error;
        }
    };

    const paymentAmount = mode === 'cart'
        ? finalTotal
        : Number(singleOrder?.payment?.amount ?? finalTotal);

    const bankInfo = mode === 'cart'
        ? paymentSession?.bankInfo
        : {
            bankCode: singleOrder?.payment?.bank_id,
            accountNo: singleOrder?.payment?.account_no,
            accountName: singleOrder?.payment?.account_name,
            bankName: singleOrder?.payment?.bank_name,
        };

    const qrUrl = mode === 'cart'
        ? paymentSession?.totalQrUrl
        : singleOrder?.payment?.qr_url;

    const transferContent = mode === 'cart'
        ? paymentSession?.totalTransferContent
        : singleOrder?.payment?.transfer_content;

    const orderIdForPayment = mode === 'cart' ? paymentSession?.orderId : singleOrder?.id;
    const orderCodeForPayment = mode === 'cart' ? paymentSession?.orderCode : singleOrder?.order_code;

    const bankCode = bankInfo?.bankCode || 'MB';
    const bankAccountNo = bankInfo?.accountNo || '';
    const bankAccountName = bankInfo?.accountName || '';
    const bankDisplayName = bankInfo?.bankName;
    const safeOrderId = orderIdForPayment || '';
    const safeOrderCode = orderCodeForPayment || '';
    const canShowPayment = !!(bankAccountNo && orderIdForPayment && orderCodeForPayment);

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
                        <h1 className="text-2xl font-bold text-white mb-6">Thanh toán</h1>

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
                                <div className="pt-3 border-t border-white/10 flex justify-between items-end">
                                    <span className="text-white font-medium">Thành tiền</span>
                                    <span className="text-2xl font-bold text-green-400">
                                        {finalTotal.toLocaleString('vi-VN')}đ
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* QR Code Section */}
                        <AnimatePresence>
                            {isAddressValid ? (
                                creatingPayment ? (
                                    <div className="bg-white/5 rounded-3xl p-8 text-center border border-white/10 border-dashed">
                                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3" />
                                        <p className="text-white/60">Đang tạo phiên thanh toán...</p>
                                    </div>
                                ) : paymentError ? (
                                    <div className="bg-red-500/10 rounded-3xl p-8 text-center border border-red-500/30">
                                        <p className="text-red-400">{paymentError}</p>
                                    </div>
                                ) : canShowPayment ? (
                                    <motion.div
                                        key="payment-qr"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                    >
                                        <PaymentQR
                                            orderId={orderIdForPayment}
                                            orderCode={orderCodeForPayment}
                                            transferContent={transferContent}
                                            qrUrl={qrUrl}
                                            amount={paymentAmount}
                                            bankId={(bankCode || 'MB') as any}
                                            accountNo={bankAccountNo}
                                            accountName={bankAccountName}
                                            bankName={bankDisplayName}
                                            onPaymentConfirmed={() => handlePaymentConfirmed(safeOrderId, safeOrderCode, mode === 'cart')}
                                        />
                                    </motion.div>
                                ) : (
                                    <div className="bg-red-500/10 rounded-3xl p-8 text-center border border-red-500/30">
                                        <p className="text-red-400">Lỗi cấu hình thanh toán. Vui lòng liến hệ admin.</p>
                                    </div>
                                )
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
