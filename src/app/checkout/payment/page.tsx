'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useCart } from '@/lib/store/cart';
import { getSupabase } from '@/lib/supabase/client';
import { PaymentQR } from '@/components/PaymentQR';
import { generateId } from '@/lib/generateId';

export default function CheckoutPaymentPage() {
    const router = useRouter();
    const { items, totalPrice, clearCart } = useCart();
    const [orderCode, setOrderCode] = useState('');
    const [orderId, setOrderId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'checking' | 'success'>('pending');

    // Bank config - should come from settings
    const bankConfig = {
        bankId: 'MB' as const,
        accountNo: '0123456789',
        accountName: 'NGUYEN VAN A',
    };

    useEffect(() => {
        createOrder();
    }, []);

    const createOrder = async () => {
        if (items.length === 0) {
            router.push('/cart');
            return;
        }

        try {
            const supabase = getSupabase();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login?redirect=/checkout/payment');
                return;
            }

            const newOrderCode = generateId.order();
            const depositAmount = Math.round(totalPrice * 0.5);

            // Create order
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    order_code: newOrderCode,
                    user_id: user.id,
                    order_type: 'ready_made',
                    status: 'pending',
                    subtotal: totalPrice,
                    shipping_fee: 30000,
                    total: totalPrice + 30000,
                    deposit_amount: depositAmount,
                })
                .select()
                .single();

            if (orderError) {
                setError('Không thể tạo đơn hàng: ' + orderError.message);
                setLoading(false);
                return;
            }

            // Create order items
            const orderItems = items.map(item => ({
                order_id: order.id,
                product_id: item.productId,
                sku: item.sku,
                name: item.name,
                quantity: item.quantity,
                unit_price: item.price,
                total_price: item.price * item.quantity,
                configuration: { size: item.size },
            }));

            await supabase.from('order_items').insert(orderItems);

            setOrderCode(newOrderCode);
            setOrderId(order.id);
            setLoading(false);
        } catch (err) {
            setError('Đã có lỗi xảy ra: ' + (err as Error).message);
            setLoading(false);
        }
    };

    const handlePaymentConfirmed = () => {
        setPaymentStatus('success');
        clearCart();
        setTimeout(() => {
            router.push(`/account/orders/${orderId}`);
        }, 2000);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-32 pb-20 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white/50">Đang tạo đơn hàng...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-32 pb-20 flex items-center justify-center px-6">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Đã có lỗi xảy ra</h2>
                    <p className="text-white/50 mb-6">{error}</p>
                    <Link href="/cart" className="px-6 py-3 bg-white text-black rounded-xl font-medium">
                        Quay lại giỏ hàng
                    </Link>
                </div>
            </div>
        );
    }

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
                        Mã đơn hàng: <span className="text-white font-mono">{orderCode}</span>
                    </p>
                    <p className="text-white/50 text-sm">Đang chuyển đến trang theo dõi đơn hàng...</p>
                </motion.div>
            </div>
        );
    }

    const depositAmount = Math.round(totalPrice * 0.5);

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-32 pb-20">
            <div className="max-w-4xl mx-auto px-6">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-white mb-2">Thanh Toán</h1>
                    <p className="text-white/50">
                        Mã đơn hàng: <span className="text-white font-mono">{orderCode}</span>
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* QR Section */}
                    <PaymentQR
                        orderCode={orderCode}
                        amount={depositAmount}
                        bankId={bankConfig.bankId}
                        accountNo={bankConfig.accountNo}
                        accountName={bankConfig.accountName}
                    />

                    {/* Order Summary */}
                    <div className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Tóm tắt đơn hàng</h3>

                        <div className="space-y-3 mb-6">
                            {items.map(item => (
                                <div key={item.id} className="flex justify-between text-sm">
                                    <span className="text-white/70">
                                        {item.name} x{item.quantity}
                                    </span>
                                    <span className="text-white">
                                        {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-white/10 pt-4 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-white/50">Tạm tính</span>
                                <span className="text-white">{totalPrice.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/50">Phí ship</span>
                                <span className="text-white">30,000đ</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/10">
                                <span className="text-white">Tổng cộng</span>
                                <span className="text-white">{(totalPrice + 30000).toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex justify-between text-green-400">
                                <span>Cọc 50%</span>
                                <span className="font-bold">{depositAmount.toLocaleString('vi-VN')}đ</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-6 space-y-3">
                            <button
                                onClick={handlePaymentConfirmed}
                                className="w-full py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
                            >
                                Đã chuyển khoản xong
                            </button>
                            <Link
                                href="/account/orders"
                                className="block w-full py-3 bg-white/5 text-white/70 rounded-xl font-medium text-center hover:bg-white/10 transition-colors"
                            >
                                Xem đơn hàng của tôi
                            </Link>
                        </div>

                        <p className="text-white/40 text-xs text-center mt-4">
                            Admin sẽ xác nhận thanh toán trong vòng 5-10 phút
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
