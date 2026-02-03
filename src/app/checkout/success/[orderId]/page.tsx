'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/Button';
import { getBankConfig, BANK_INFO, type BankCode } from '@/lib/vietqr';

interface SubOrder {
    type: string;
    orderNumber: string;
    status: string;
}

interface MasterOrder {
    id: string;
    order_number: string; // Primary identifier for master_orders
    order_code: string;   // Fallback for compatibility
    subtotal: number;
    shipping: number;
    total: number;
    status: string;
    payment_status: string;
    created_at: string;
    address: {
        full_name: string;
        phone: string;
        address_line: string;
        province: string;
    };
    orders?: { order_code: string; status: string; total: number }[];
    print_orders?: { order_number: string; status: string; total_price: number }[];
    custom_orders?: { order_number: string; status: string; estimated_price: number }[];
}

// Icons
const CheckIcon = () => (
    <svg className="w-16 h-16 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

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

const getTypeIcon = (type: string) => {
    switch (type) {
        case 'product': return <ProductIcon />;
        case 'print': return <PrintIcon />;
        case 'custom': return <CustomIcon />;
        default: return <ProductIcon />;
    }
};

const getTypeLabel = (type: string) => {
    switch (type) {
        case 'product': return 'Sản phẩm';
        case 'print': return 'In 3D';
        case 'custom': return 'Custom';
        default: return type;
    }
};

const getTypeColor = (type: string) => {
    switch (type) {
        case 'product': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'print': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
        case 'custom': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
        default: return 'bg-white/10 text-white/70';
    }
};

export default function CheckoutSuccessPage() {
    const params = useParams();
    const orderId = params.orderId as string;
    const [order, setOrder] = useState<MasterOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [subOrders, setSubOrders] = useState<SubOrder[]>([]);
    const [hasConfirmedPayment, setHasConfirmedPayment] = useState(false);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                // Use new unified lookup API that searches all order tables
                const res = await fetch(`/api/orders/lookup?id=${orderId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.data) {
                        const orderData = data.data;
                        setOrder({
                            id: orderData.id,
                            order_number: orderData.order_code,
                            order_code: orderData.order_code,
                            subtotal: orderData.total,
                            shipping: 0,
                            total: orderData.total,
                            status: orderData.status,
                            payment_status: orderData.payment_status,
                            created_at: orderData.created_at,
                            address: orderData.shipping_address || {},
                            // Store payment info for QR
                            payment: orderData.payment,
                        } as any);

                        // If already paid, skip payment view
                        if (orderData.payment_status === 'paid' || orderData.deposit_paid) {
                            setHasConfirmedPayment(true);
                        }

                        // Set sub-orders based on order type
                        setSubOrders([{
                            type: orderData.order_type === 'custom' ? 'custom' : orderData.order_type === 'printing' ? 'print' : 'product',
                            orderNumber: orderData.order_code,
                            status: orderData.status,
                        }]);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch order:', err);
            }
            setLoading(false);
        };

        if (orderId) {
            fetchOrder();
        }
    }, [orderId]);

    const handleConfirmPayment = () => {
        setHasConfirmedPayment(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

    if (!order) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-32 pb-20 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-4">Không tìm thấy đơn hàng</p>
                    <Link href="/">
                        <Button variant="secondary">Về trang chủ</Button>
                    </Link>
                </div>
            </div>
        );
    }

    // 1. PAYMENT VIEW (Shown first if not paid/confirmed)
    if (!hasConfirmedPayment) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orderAny = order as any;
        const payment = orderAny?.payment;
        const depositAmount = orderAny?.deposit_amount || Math.round(order.total * 0.5);
        const qrUrl = payment?.qr_url || `https://img.vietqr.io/image/MB-0359123456-compact2.png?amount=${depositAmount}&addInfo=${encodeURIComponent(`MINWSUN_${orderId}`)}`;
        const transferContent = payment?.transfer_content || `MINWSUN_${orderId}`;
        const bankName = payment?.bank_id ? (BANK_INFO[payment.bank_id as BankCode]?.shortName || payment.bank_id) : 'MB Bank';
        const accountNo = payment?.account_no || '0359123456';
        const accountName = payment?.account_name || 'MINWSUN';

        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
                <div className="max-w-[600px] mx-auto px-6">
                    <AnimatedSection className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Vui Lòng Thanh Toán</h1>
                        <p className="text-white/60">Quét mã QR để hoàn tất đơn hàng</p>
                    </AnimatedSection>

                    <AnimatedSection delay={0.1}>
                        <div className="bg-[#1D1D1F] rounded-3xl p-8 mb-6 border border-white/5">
                            {/* QR Code */}
                            <div className="bg-white rounded-2xl p-4 max-w-[280px] mx-auto mb-8 shadow-2xl">
                                <img
                                    src={qrUrl}
                                    alt="VietQR Payment"
                                    className="w-full aspect-square object-contain"
                                />
                                <p className="text-center text-xs text-gray-500 mt-2 font-medium">Quét mã để chuyển khoản tự động</p>
                            </div>

                            {/* Bank Info */}
                            <div className="space-y-4 mb-8">
                                <div className="bg-white/5 rounded-xl p-4 space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-white/50">Ngân hàng</span>
                                        <span className="text-white font-medium">{bankName}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-white/50">Số tài khoản</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-mono text-lg">{accountNo}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-white/50">Chủ tài khoản</span>
                                        <span className="text-white font-medium uppercase">{accountName}</span>
                                    </div>
                                    <div className="h-px bg-white/10 my-2" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-white/50">Số tiền cọc (50%)</span>
                                        <span className="text-green-400 font-bold text-xl">{depositAmount.toLocaleString('vi-VN')}đ</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-white/50">Nội dung CK</span>
                                        <span className="text-yellow-400 font-mono font-bold bg-yellow-400/10 px-3 py-1 rounded-lg select-all cursor-text">{transferContent}</span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                    <svg className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-sm text-blue-200/80">
                                        Nội dung chuyển khoản chính xác giúp hệ thống tự động xác nhận đơn hàng của bạn nhanh chóng hơn.
                                    </p>
                                </div>
                            </div>

                            <Button
                                variant="primary"
                                size="lg"
                                className="w-full h-14 text-lg font-medium shadow-lg shadow-primary/20"
                                onClick={handleConfirmPayment}
                            >
                                Tôi đã chuyển khoản xong
                            </Button>
                        </div>

                        <div className="text-center">
                            <button
                                onClick={() => setHasConfirmedPayment(true)}
                                className="text-white/40 text-sm hover:text-white transition-colors"
                            >
                                Bỏ qua bước này (Thanh toán sau)
                            </button>
                        </div>
                    </AnimatedSection>
                </div>
            </div>
        );
    }

    // 2. SUCCESS VIEW (Shown after confirmation)
    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[800px] mx-auto px-6">
                {/* Success Header */}
                <AnimatedSection className="text-center mb-12">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6"
                    >
                        <CheckIcon />
                    </motion.div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        Đặt Hàng Thành Công!
                    </h1>
                    <p className="text-white/60">
                        Cảm ơn bạn đã đặt hàng. Đơn hàng của bạn đang chờ xác nhận thanh toán.
                    </p>
                </AnimatedSection>

                {/* Master Order Info */}
                <AnimatedSection delay={0.1}>
                    <div className="bg-[#1D1D1F] rounded-3xl p-8 mb-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <p className="text-white/50 text-sm">Mã đơn hàng</p>
                                <p className="text-2xl font-bold text-white font-mono">{orderId}</p>
                            </div>
                            <div className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-xl text-sm font-medium">
                                Chờ xác nhận
                            </div>
                        </div>

                        {/* Sub-orders */}
                        {subOrders.length > 0 && (
                            <div className="mb-6">
                                <p className="text-white/50 text-sm mb-3">Đơn hàng chi tiết</p>
                                <div className="space-y-2">
                                    {subOrders.map((sub, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-center gap-3 p-3 rounded-xl border ${getTypeColor(sub.type)}`}
                                        >
                                            {getTypeIcon(sub.type)}
                                            <span className="font-mono text-sm">{sub.orderNumber}</span>
                                            <span className="text-xs opacity-70">{getTypeLabel(sub.type)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Order summary */}
                        {order && (
                            <div className="border-t border-white/10 pt-6 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-white/60">Tạm tính</span>
                                    <span className="text-white">{order.subtotal.toLocaleString('vi-VN')}đ</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-white/60">Phí vận chuyển</span>
                                    <span className="text-white">{order.shipping.toLocaleString('vi-VN')}đ</span>
                                </div>
                                <div className="flex justify-between font-medium">
                                    <span className="text-white">Tổng cộng</span>
                                    <span className="text-white text-lg">{order.total.toLocaleString('vi-VN')}đ</span>
                                </div>
                            </div>
                        )}
                    </div>
                </AnimatedSection>

                {/* Delivery Address */}
                {order?.address && (
                    <AnimatedSection delay={0.2}>
                        <div className="bg-[#1D1D1F] rounded-3xl p-8 mb-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Địa chỉ giao hàng</h3>
                            <div className="text-white/70">
                                <p className="font-medium text-white">{order.address.full_name}</p>
                                <p className="text-sm mt-1">{order.address.phone}</p>
                                <p className="text-sm mt-1">
                                    {order.address.address_line}, {order.address.province}
                                </p>
                            </div>
                        </div>
                    </AnimatedSection>
                )}

                {/* Actions */}
                <AnimatedSection delay={0.3}>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/account/orders">
                            <Button variant="primary" size="lg">
                                Xem đơn hàng của tôi
                            </Button>
                        </Link>
                        <Link href="/products">
                            <Button variant="secondary" size="lg">
                                Tiếp tục mua sắm
                            </Button>
                        </Link>
                    </div>
                </AnimatedSection>
            </div>
        </div>
    );
}
