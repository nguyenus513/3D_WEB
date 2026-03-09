'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/button';
import { PaymentQR } from '@/components/PaymentQR';
import { CheckCircle, Box, Boxes, PenLine } from 'lucide-react';

interface OrderData {
    id: string;
    order_code: string;
    order_type: string;
    total: number;
    deposit_amount?: number;
    status: string;
    payment_status: string;
    created_at: string;
    shipping_address?: {
        full_name?: string;
        name?: string;
        phone?: string;
        address_line?: string;
        address?: string;
        ward?: string;
        district?: string;
        province?: string;
        city?: string;
    };
    items?: Array<{
        name: string;
        quantity: number;
        unit_price: number;
        total_price: number;
        item_type?: string;
    }>;
}

interface PaymentConfig {
    bank_code: string;
    account_no: string;
    account_name: string;
}

const getTypeLabel = (type: string) => {
    switch (type) {
        case 'product': return 'Sản phẩm';
        case 'print_3d': return 'In 3D';
        case 'custom': return 'Custom Figurine';
        case 'mixed': return 'Hỗn hợp';
        default: return 'Sản phẩm';
    }
};

const getTypeIcon = (type: string) => {
    switch (type) {
        case 'print_3d': return <Boxes size={20} strokeWidth={1.5} />;
        case 'custom': return <PenLine size={20} strokeWidth={1.5} />;
        default: return <Box size={20} strokeWidth={1.5} />;
    }
};

const getTypeColor = (type: string) => {
    switch (type) {
        case 'print_3d': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
        case 'custom': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
        case 'mixed': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
        default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
};

export default function CheckoutSuccessPage() {
    const params = useParams();
    const orderId = params.orderId as string;

    const [order, setOrder] = useState<OrderData | null>(null);
    const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasConfirmedPayment, setHasConfirmedPayment] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [orderRes, configRes] = await Promise.all([
                    fetch(`/api/orders/lookup?id=${orderId}`),
                    fetch('/api/payment-config'),
                ]);

                if (orderRes.ok) {
                    const json = await orderRes.json();
                    const data = json.data || json;
                    setOrder(data);
                    if (data.payment_status === 'paid' || data.status === 'pending_confirmation' || data.status === 'confirmed') {
                        setHasConfirmedPayment(true);
                    }
                }

                if (configRes.ok) {
                    const config = await configRes.json();
                    setPaymentConfig(config);
                }
            } catch (err) {
                console.error('Failed to fetch order:', err);
            } finally {
                setLoading(false);
            }
        };

        if (orderId) fetchData();
    }, [orderId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg-void)] pt-32 pb-20 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-[var(--border-color)] border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[var(--text-secondary)]">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-[var(--bg-void)] pt-32 pb-20 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-4">Không tìm thấy đơn hàng</p>
                    <Link href="/">
                        <Button variant="secondary">Về trang chủ</Button>
                    </Link>
                </div>
            </div>
        );
    }

    const isCustomOrder = order.order_type === 'custom' || order.order_type === 'mixed';
    const payAmount = order.deposit_amount || order.total;

    if (hasConfirmedPayment) {
        return (
            <div className="min-h-screen bg-[var(--bg-void)] pt-28 pb-20">
                <div className="max-w-[800px] mx-auto px-6">
                    <AnimatedSection className="text-center mb-12">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                            className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6"
                        >
                            <CheckCircle size={64} className="text-green-400" strokeWidth={2} />
                        </motion.div>
                        <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">
                            Đặt Hàng Thành Công!
                        </h1>
                        <p className="text-[var(--text-secondary)]">
                            Cảm ơn bạn đã đặt hàng. Đơn hàng của bạn đang chờ xác nhận thanh toán.
                        </p>
                    </AnimatedSection>

                    <AnimatedSection delay={0.1}>
                        <div className="bg-[var(--material-panel)] rounded-3xl p-8 mb-6 border border-[var(--border-color)]">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <p className="text-[var(--text-secondary)] text-sm">Mã đơn hàng</p>
                                    <p className="text-2xl font-bold text-[var(--text-primary)] font-mono">{order.order_code}</p>
                                </div>
                                <div className={`px-4 py-2 rounded-xl text-sm font-medium border flex items-center gap-2 ${getTypeColor(order.order_type)}`}>
                                    {getTypeIcon(order.order_type)}
                                    {getTypeLabel(order.order_type)}
                                </div>
                            </div>

                            {order.items && order.items.length > 0 && (
                                <div className="mb-6">
                                    <p className="text-[var(--text-secondary)] text-sm mb-3">Chi tiết đơn hàng</p>
                                    <div className="space-y-2">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center py-2 border-b border-[var(--border-color)] last:border-b-0">
                                                <div className="flex items-center gap-2">
                                                    {getTypeIcon(item.item_type || order.order_type)}
                                                    <span className="text-[var(--text-primary)] text-sm">{item.name}</span>
                                                    <span className="text-[var(--text-tertiary)] text-xs">x{item.quantity}</span>
                                                </div>
                                                <span className="text-[var(--text-primary)] text-sm font-medium">
                                                    {(item.total_price || item.unit_price * item.quantity).toLocaleString('vi-VN')}đ
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="border-t border-[var(--border-color)] pt-6 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-[var(--text-secondary)]">Tổng cộng</span>
                                    <span className="text-[var(--text-primary)]">{order.total.toLocaleString('vi-VN')}đ</span>
                                </div>
                                {isCustomOrder && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[var(--text-secondary)]">Đặt cọc 50%</span>
                                        <span className="text-[var(--text-primary)]">{payAmount.toLocaleString('vi-VN')}đ</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </AnimatedSection>

                    {order.shipping_address && (
                        <AnimatedSection delay={0.2}>
                            <div className="bg-[var(--material-panel)] rounded-3xl p-8 mb-6 border border-[var(--border-color)]">
                                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Địa chỉ giao hàng</h3>
                                <div className="text-[var(--text-secondary)] space-y-2">
                                    {(order.shipping_address.full_name || order.shipping_address.name) && (
                                        <p className="font-medium text-[var(--text-primary)] text-base">{order.shipping_address.full_name || order.shipping_address.name}</p>
                                    )}
                                    {order.shipping_address.phone && (
                                        <p className="text-sm">{order.shipping_address.phone}</p>
                                    )}
                                    <p className="text-sm">
                                        {[
                                            order.shipping_address.address_line || order.shipping_address.address,
                                            order.shipping_address.ward,
                                            order.shipping_address.district,
                                            order.shipping_address.province || order.shipping_address.city,
                                        ].filter(Boolean).join(', ')}
                                    </p>
                                </div>
                            </div>
                        </AnimatedSection>
                    )}

                    <AnimatedSection delay={0.3}>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link href="/account/orders">
                                <Button variant="default" size="lg">
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

    return (
        <div className="min-h-screen bg-[var(--bg-void)] pt-28 pb-20">
            <div className="max-w-[700px] mx-auto px-6">
                <AnimatedSection className="text-center mb-8">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border mb-4 ${getTypeColor(order.order_type)}`}>
                        {getTypeIcon(order.order_type)}
                        {getTypeLabel(order.order_type)}
                    </div>
                    <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Thanh Toán Đơn Hàng</h1>
                    <p className="text-[var(--text-secondary)]">
                        Mã đơn: <span className="font-mono text-[var(--text-primary)]">{order.order_code}</span>
                    </p>
                </AnimatedSection>

                {order.items && order.items.length > 0 && (
                    <AnimatedSection delay={0.05}>
                        <div className="bg-[var(--material-panel)] rounded-3xl p-6 mb-6 border border-[var(--border-color)]">
                            <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-4">Chi tiết đơn hàng</h3>
                            <div className="space-y-2">
                                {order.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center py-2 border-b border-[var(--border-color)] last:border-b-0">
                                        <div>
                                            <p className="text-[var(--text-primary)] text-sm font-medium">{item.name}</p>
                                            <p className="text-[var(--text-tertiary)] text-xs">SL: {item.quantity}</p>
                                        </div>
                                        <span className="text-[var(--text-primary)] text-sm">
                                            {(item.total_price || item.unit_price * item.quantity).toLocaleString('vi-VN')}đ
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="border-t border-[var(--border-color)] mt-4 pt-4 flex justify-between">
                                <span className="text-[var(--text-secondary)] text-sm">Tổng cộng</span>
                                <span className="text-[var(--text-primary)] font-semibold">{order.total.toLocaleString('vi-VN')}đ</span>
                            </div>
                            {isCustomOrder && (
                                <div className="flex justify-between mt-2">
                                    <span className="text-[var(--text-secondary)] text-sm">Cần thanh toán (đặt cọc 50%)</span>
                                    <span className="text-green-400 font-bold">{payAmount.toLocaleString('vi-VN')}đ</span>
                                </div>
                            )}
                        </div>
                    </AnimatedSection>
                )}

                <AnimatedSection delay={0.1}>
                    {paymentConfig?.account_no ? (
                        <PaymentQR
                            orderId={order.id}
                            orderCode={order.order_code}
                            amount={payAmount}
                            bankId={paymentConfig.bank_code as any}
                            accountNo={paymentConfig.account_no}
                            accountName={paymentConfig.account_name}
                            transferContent={order.order_code}
                            onPaymentConfirmed={async () => {
                                setHasConfirmedPayment(true);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                        />
                    ) : (
                        <div className="bg-red-500/10 rounded-3xl p-8 text-center border border-red-500/30">
                            <p className="text-red-400">Lỗi cấu hình thanh toán. Vui lòng liên hệ admin.</p>
                        </div>
                    )}
                </AnimatedSection>

                <AnimatedSection delay={0.15}>
                    <div className="text-center mt-6">
                        <Link href="/account/orders" className="text-[var(--text-tertiary)] text-sm hover:text-[var(--text-primary)] transition-colors">
                            Thanh toán sau — Xem đơn hàng của tôi
                        </Link>
                    </div>
                </AnimatedSection>
            </div>
        </div>
    );
}
