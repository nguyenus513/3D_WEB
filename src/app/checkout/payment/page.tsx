'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useCart } from '@/lib/store/cart';
import { PaymentQR } from '@/components/PaymentQR';
import { generateId } from '@/lib/generateId';
import { getBankConfig, type OrderType } from '@/lib/vietqr';
import { getSupabase } from '@/lib/supabase/client';

interface OrderInfo {
    orderCode: string;
    customerCode: string;
    totalPrice: number;
    depositAmount: number;
    orderType: OrderType;
    itemCount: number;
}

function PaymentContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');

    const { items, totalPrice: cartTotal, clearCart, isHydrated } = useCart();
    const { data: session, status } = useSession();

    // State
    const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState('');

    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success'>('pending');
    const [dbSaveStatus, setDbSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // Bank config based on order type
    const bankConfig = getBankConfig(orderInfo?.orderType || 'ready_made');

    // Determine which flow to use and load order data
    useEffect(() => {
        console.log('=== PAYMENT PAGE LOAD ===');
        console.log('orderId from URL:', orderId);
        console.log('isHydrated:', isHydrated);
        console.log('cart items.length:', items.length);

        if (orderId) {
            // Custom/Direct flow - order already exists in DB
            console.log('Using CUSTOM flow with orderId');
            loadOrderFromDb(orderId);
        } else if (isHydrated) {
            // Cart flow - need to check cart items
            console.log('Using CART flow');
            handleCartFlow();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId, isHydrated, items.length]);

    // Load order from database (Custom flow)
    const loadOrderFromDb = async (id: string) => {
        try {
            const supabase = getSupabase();

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .select('*')
                .eq('id', id)
                .single();

            if (orderError || !order) {
                console.error('Order not found:', orderError);
                setError('Không tìm thấy đơn hàng');
                setIsReady(true);
                return;
            }

            console.log('Order loaded from DB:', order);

            // Get customer code from user
            let customerCode = '';
            if (session?.user?.email) {
                try {
                    const res = await fetch('/api/profile');
                    if (res.ok) {
                        const userData = await res.json();
                        customerCode = userData?.customer_code || '';
                    }
                } catch (e) {
                    console.error('Failed to fetch profile', e);
                }
            }

            setOrderInfo({
                orderCode: order.order_code,
                customerCode: customerCode || generateId.user(),
                totalPrice: order.total,
                depositAmount: order.deposit_amount || Math.round(order.total * 0.5),
                orderType: order.order_type as OrderType,
                itemCount: 1,
            });
            setDbSaveStatus('saved');
            setIsReady(true);

        } catch (err) {
            console.error('Load order error:', err);
            setError('Lỗi tải đơn hàng');
            setIsReady(true);
        }
    };

    // Handle cart flow
    const handleCartFlow = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));

        if (items.length === 0) {
            console.log('Cart is empty');
            setError('Giỏ hàng trống');
            setIsReady(true);
            return;
        }

        const shippingFee = 0; // No shipping fee
        const total = cartTotal + shippingFee;
        const orderCode = generateId.order();
        const customerCode = generateId.user();

        setOrderInfo({
            orderCode,
            customerCode,
            totalPrice: total,
            depositAmount: Math.round(total * 0.5),
            orderType: 'ready_made',
            itemCount: items.length,
        });

        saveCartOrderToDb(orderCode, customerCode);
        setIsReady(true);
    };

    // Save cart order to database
    const saveCartOrderToDb = async (orderCode: string, customerCode: string) => {
        if (!session?.user?.email || items.length === 0) return;

        setDbSaveStatus('saving');

        try {
            const savedAddress = sessionStorage.getItem('checkout_address');
            const savedNote = sessionStorage.getItem('checkout_note');

            const response = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderCode,
                    customerCode,
                    items: items.map(item => ({
                        productId: item.productId,
                        sku: item.sku,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        size: item.size,
                    })),
                    totalPrice: cartTotal,
                    shippingAddress: savedAddress ? JSON.parse(savedAddress) : null,
                    customerNote: savedNote || undefined,
                    orderType: 'ready_made',
                }),
            });

            if (response.ok) {
                setDbSaveStatus('saved');
                console.log('✓ Cart order saved');
            } else {
                console.error('Failed to save order');
                setDbSaveStatus('error');
            }
        } catch (err) {
            console.error('Save error:', err);
            setDbSaveStatus('error');
        }
    };

    // Check auth
    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            router.push('/login?redirect=/checkout');
        }
    }, [status, router]);

    const handlePaymentConfirmed = () => {
        setPaymentStatus('success');

        if (!orderId) {
            clearCart();
        }

        sessionStorage.removeItem('checkout_items');
        sessionStorage.removeItem('checkout_total');
        sessionStorage.removeItem('checkout_address');
        sessionStorage.removeItem('checkout_note');
        sessionStorage.removeItem('checkout_order_type');
        sessionStorage.removeItem('checkout_order_id');

        setTimeout(() => {
            router.push('/account/orders');
        }, 2000);
    };

    // Loading state
    if (!isReady) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-32 pb-20 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white/50">Đang tải đơn hàng...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !orderInfo) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-32 pb-20 flex items-center justify-center px-6">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Lỗi</h2>
                    <p className="text-white/50 mb-6">{error || 'Không tìm thấy thông tin đơn hàng'}</p>
                    <div className="flex gap-4 justify-center">
                        <Link href="/products" className="px-6 py-3 bg-white text-black rounded-xl font-medium">
                            Xem sản phẩm
                        </Link>
                        <Link href="/custom" className="px-6 py-3 bg-white/10 text-white rounded-xl font-medium">
                            Custom
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Success state
    if (paymentStatus === 'success') {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-32 pb-20 flex items-center justify-center px-6">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center max-w-md"
                >
                    <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Đặt hàng thành công!</h2>
                    <p className="text-white/50 mb-6">
                        Mã đơn hàng: <span className="text-white font-mono">{orderInfo.orderCode}</span>
                    </p>
                    <p className="text-white/50 text-sm">Đang chuyển đến trang đơn hàng...</p>
                </motion.div>
            </div>
        );
    }

    // Main Payment UI
    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-32 pb-20">
            <div className="max-w-4xl mx-auto px-6">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-white mb-2">Thanh Toán</h1>
                    <p className="text-white/50">
                        Mã đơn hàng: <span className="text-white font-mono">{orderInfo.orderCode}</span>
                    </p>
                    {dbSaveStatus === 'saving' && (
                        <p className="text-yellow-400 text-xs mt-1">⏳ Đang lưu đơn hàng...</p>
                    )}
                    {dbSaveStatus === 'saved' && (
                        <p className="text-green-400 text-xs mt-1">✓ Đơn hàng đã được gửi đến admin</p>
                    )}
                    {dbSaveStatus === 'error' && (
                        <p className="text-red-400 text-xs mt-1">⚠️ Lỗi lưu đơn - vui lòng chụp màn hình</p>
                    )}
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* QR Section */}
                    <PaymentQR
                        orderCode={orderInfo.orderCode}
                        customerCode={orderInfo.customerCode}
                        amount={orderInfo.depositAmount}
                        bankId={bankConfig.bankId}
                        accountNo={bankConfig.accountNo}
                        accountName={bankConfig.accountName}
                    />

                    {/* Info Section */}
                    <div className="space-y-6">
                        {/* Order Summary */}
                        <div className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Chi tiết đơn hàng</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-white/60">Mã khách hàng</span>
                                    <span className="text-white font-mono">{orderInfo.customerCode}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/60">Loại đơn hàng</span>
                                    <span className="text-white capitalize">{orderInfo.orderType}</span>
                                </div>
                                <div className="border-t border-white/10 my-2" />
                                <div className="flex justify-between font-medium">
                                    <span className="text-white">Tổng cộng</span>
                                    <span className="text-white">{orderInfo.totalPrice.toLocaleString('vi-VN')}đ</span>
                                </div>
                                <div className="flex justify-between text-green-400 font-medium">
                                    <span>Thanh toán ngay (50%)</span>
                                    <span>{orderInfo.depositAmount.toLocaleString('vi-VN')}đ</span>
                                </div>
                            </div>
                        </div>

                        {/* Confirm Button */}
                        <button
                            onClick={handlePaymentConfirmed}
                            className="w-full py-4 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Tôi đã thanh toán
                        </button>

                        {/* Back Link */}
                        <Link
                            href={orderId ? "/custom" : "/cart"}
                            className="block text-center text-white/50 text-sm hover:text-white transition-colors"
                        >
                            Quay lại
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Loading fallback
function PaymentLoading() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-32 pb-20 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/50">Đang tải...</p>
            </div>
        </div>
    );
}

// Export with Suspense boundary
export default function CheckoutPaymentPage() {
    return (
        <Suspense fallback={<PaymentLoading />}>
            <PaymentContent />
        </Suspense>
    );
}
