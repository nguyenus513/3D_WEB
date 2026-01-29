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
    order_code: string;
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

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const res = await fetch('/api/orders/master');
                if (res.ok) {
                    const data = await res.json();
                    const found = data.orders?.find((o: MasterOrder) => o.order_code === orderId);
                    if (found) {
                        setOrder(found);

                        // Build sub-orders list
                        const subs: SubOrder[] = [];
                        found.orders?.forEach((o: any) => subs.push({ type: 'product', orderNumber: o.order_code, status: o.status }));
                        found.print_orders?.forEach((o: any) => subs.push({ type: 'print', orderNumber: o.order_number, status: o.status }));
                        found.custom_orders?.forEach((o: any) => subs.push({ type: 'custom', orderNumber: o.order_number, status: o.status }));
                        setSubOrders(subs);
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
                        Cảm ơn bạn đã đặt hàng. Chúng tôi sẽ xử lý đơn hàng trong thời gian sớm nhất.
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

                {/* QR Payment Section */}
                <AnimatedSection delay={0.3}>
                    <div className="bg-[#1D1D1F] rounded-3xl p-8 mb-8">
                        <h3 className="text-lg font-semibold text-white mb-4 text-center">💳 Thanh toán chuyển khoản</h3>

                        {order && (() => {
                            const depositAmount = Math.round(order.total * 0.5);
                            const bankConfig = getBankConfig('ready_made');
                            // Use stored transfer_content from order metadata if available
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const orderAny = order as any;
                            const storedContent = orderAny?.metadata?.transfer_content;
                            const transferContent = storedContent || `MINWSUN_${orderId}`;
                            // Use stored qr_url if available
                            const storedQrUrl = orderAny?.payment_qr_url;
                            const qrUrl = storedQrUrl || `https://img.vietqr.io/image/${bankConfig.bankId}-${bankConfig.accountNo}-compact2.png?amount=${depositAmount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bankConfig.accountName)}`;

                            return (
                                <div className="space-y-6">
                                    {/* QR Code */}
                                    <div className="bg-white rounded-2xl p-4 max-w-xs mx-auto">
                                        <img
                                            src={qrUrl}
                                            alt="VietQR Payment"
                                            className="w-full aspect-square object-contain"
                                        />
                                        <p className="text-center text-xs text-gray-500 mt-2">Quét mã để thanh toán</p>
                                    </div>

                                    {/* Bank Info */}
                                    <div className="text-sm space-y-2">
                                        <div className="flex justify-between py-2 border-b border-white/10">
                                            <span className="text-white/50">Ngân hàng</span>
                                            <span className="text-white font-medium">{BANK_INFO[bankConfig.bankId as BankCode].shortName}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-white/10">
                                            <span className="text-white/50">Số tài khoản</span>
                                            <span className="text-white font-mono">{bankConfig.accountNo}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-white/10">
                                            <span className="text-white/50">Chủ TK</span>
                                            <span className="text-white">{bankConfig.accountName}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-white/10">
                                            <span className="text-white/50">Nội dung CK</span>
                                            <span className="text-white font-mono text-sm bg-white/5 px-2 py-1 rounded">{transferContent}</span>
                                        </div>
                                        <div className="flex justify-between py-2">
                                            <span className="text-white/50">Số tiền cọc (50%)</span>
                                            <span className="text-green-400 font-bold text-lg">{depositAmount.toLocaleString('vi-VN')}đ</span>
                                        </div>
                                    </div>

                                    {/* Note */}
                                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm">
                                        <p className="text-yellow-400">⚠️ Ghi đúng nội dung CK để đơn hàng được xác nhận nhanh nhất</p>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </AnimatedSection>

                {/* Actions */}
                <AnimatedSection delay={0.4}>
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
