'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import { CheckCircle, Box, Boxes, ExternalLink, PenLine } from 'lucide-react';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/button';
import { PaymentQR } from '@/components/PaymentQR';

interface OrderData {
    id: string;
    order_code: string;
    order_type: string;
    total: number;
    deposit_amount?: number;
    status: string;
    payment_status: string;
    created_at?: string;
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
    } | null;
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

interface PayOSLinkData {
    checkoutUrl: string;
    qrCode?: string;
    paymentLinkId: string;
    payosOrderCode: number;
    amount: number;
}

async function getPayOSQrSrc(qrCode?: string) {
    if (!qrCode) return null;
    if (qrCode.startsWith('data:image')) return qrCode;
    if (qrCode.startsWith('http')) return qrCode;
    return QRCode.toDataURL(qrCode, { margin: 2, width: 720, color: { dark: '#000000', light: '#ffffff' } });
}

async function syncPayOSPayment(orderId: string) {
    const res = await fetch('/api/payos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
    });
    return res.json().catch(() => null);
}

function getTypeLabel(type: string) {
    switch (type) {
        case 'print_3d': return 'In 3D';
        case 'custom': return 'Custom Figurine';
        case 'mixed': return 'Hỗn hợp';
        default: return 'Sản phẩm';
    }
}

function getTypeIcon(type: string) {
    switch (type) {
        case 'print_3d': return <Boxes size={20} strokeWidth={1.5} />;
        case 'custom': return <PenLine size={20} strokeWidth={1.5} />;
        default: return <Box size={20} strokeWidth={1.5} />;
    }
}

function getTypeColor(type: string) {
    switch (type) {
        case 'print_3d': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
        case 'custom': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
        case 'mixed': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
        default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
}

function formatCurrency(value: number) {
    return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

export default function CheckoutSuccessPage() {
    const params = useParams();
    const orderId = params.orderId as string;
    const [order, setOrder] = useState<OrderData | null>(null);
    const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasConfirmedPayment, setHasConfirmedPayment] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [payosLink, setPayosLink] = useState<PayOSLinkData | null>(null);
    const [payosQrSrc, setPayosQrSrc] = useState<string | null>(null);
    const [payosLoading, setPayosLoading] = useState(false);
    const [payosError, setPayosError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);
                const [orderRes, configRes] = await Promise.all([
                    fetch(`/api/orders/lookup?id=${encodeURIComponent(orderId)}`, { cache: 'no-store' }),
                    fetch('/api/payment-config', { cache: 'no-store' }),
                ]);

                const orderJson = await orderRes.json().catch(() => null);
                if (!orderRes.ok || !orderJson?.success) {
                    setError(orderJson?.error || 'Không tìm thấy đơn hàng. Vui lòng kiểm tra trong mục đơn hàng của tôi.');
                    setOrder(null);
                    return;
                }

                const data = orderJson.data as OrderData;
                setOrder(data);
                const alreadyConfirmed = ['paid', 'pending_confirmation', 'confirmed'].includes(data.payment_status) || ['pending_confirmation', 'confirmed'].includes(data.status);
                setHasConfirmedPayment(alreadyConfirmed);
                setPaymentSuccess(data.payment_status === 'paid');

                if (configRes.ok) {
                    const configJson = await configRes.json();
                    setPaymentConfig(configJson.data || configJson);
                }

                if (!['paid', 'confirmed'].includes(data.payment_status)) {
                    const syncJson = await syncPayOSPayment(data.id);
                    if (syncJson?.success && syncJson?.paid) {
                        setOrder({ ...data, payment_status: 'paid', status: 'confirmed' });
                        setHasConfirmedPayment(true);
                        setPaymentSuccess(true);
                        return;
                    }

                    setPayosLoading(true);
                    try {
                        const payosRes = await fetch('/api/payos/payment-link', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderId: data.id }),
                        });
                        const payosJson = await payosRes.json().catch(() => null);
                        if (payosRes.ok && payosJson?.success && payosJson.data?.checkoutUrl) {
                            setPayosLink(payosJson.data);
                            setPayosQrSrc(await getPayOSQrSrc(payosJson.data.qrCode));
                            setPayosError(null);
                        } else {
                            setPayosError(`${payosJson?.error || `HTTP ${payosRes.status}`}${payosJson?.stage ? ` @${payosJson.stage}` : ''}`);
                        }
                    } catch (payosError) {
                        console.warn('PayOS unavailable:', payosError);
                        setPayosError(payosError instanceof Error ? payosError.message : 'PAYOS_ERROR');
                    } finally {
                        setPayosLoading(false);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch order:', err);
                setError('Không thể tải thông tin đơn hàng. Vui lòng thử lại sau.');
                setOrder(null);
            } finally {
                setLoading(false);
            }
        };

        if (orderId) fetchData();
    }, [orderId]);

    useEffect(() => {
        if (!order?.id || !payosLink || hasConfirmedPayment) return;

        const sync = async () => {
            const syncJson = await syncPayOSPayment(order.id);
            if (syncJson?.success && syncJson?.paid) {
                setOrder((current) => current ? { ...current, payment_status: 'paid', status: 'confirmed' } : current);
                setHasConfirmedPayment(true);
                setPaymentSuccess(true);
            }
        };

        const intervalId = window.setInterval(sync, 5000);
        return () => window.clearInterval(intervalId);
    }, [order?.id, payosLink, hasConfirmedPayment]);

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
                <div className="text-center max-w-md px-6">
                    <p className="text-red-400 mb-2">Không tìm thấy đơn hàng</p>
                    {error && <p className="text-[var(--text-secondary)] text-sm mb-6">{error}</p>}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link href="/account/orders"><Button>Xem đơn hàng của tôi</Button></Link>
                        <Link href="/"><Button variant="secondary">Về trang chủ</Button></Link>
                    </div>
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
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                            <CheckCircle size={64} className="text-green-400" strokeWidth={2} />
                        </motion.div>
                        <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">Đặt hàng thành công!</h1>
                        <p className="text-[var(--text-secondary)]">Cảm ơn bạn đã đặt hàng. Đơn hàng của bạn đang chờ xác nhận thanh toán.</p>
                    </AnimatedSection>
                    <OrderSummary order={order} payAmount={payAmount} isCustomOrder={isCustomOrder} />
                    <OrderAddress order={order} />
                    <ActionLinks />
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
                    <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Thanh toán đơn hàng</h1>
                    <p className="text-[var(--text-secondary)]">Mã đơn: <span className="font-mono text-[var(--text-primary)]">{order.order_code}</span></p>
                </AnimatedSection>

                <OrderSummary order={order} payAmount={payAmount} isCustomOrder={isCustomOrder} compact />

                <AnimatedSection delay={0.1}>
                    <div className="mb-5 rounded-3xl border border-white/15 bg-white/[0.06] p-5">
                        <div className="mb-4">
                            <p className="text-sm uppercase tracking-[0.18em] text-white/45">PayOS</p>
                            <h2 className="mt-1 text-xl font-semibold text-white">Thanh toán tự động</h2>
                            <p className="mt-1 text-sm text-white/60">Thanh toán qua PayOS sẽ tự xác nhận đơn hàng khi giao dịch thành công.</p>
                        </div>
                        {payosLink ? (
                            <div className="space-y-4">
                                {payosQrSrc ? (
                                    <div className="rounded-3xl bg-white p-4">
                                        <img src={payosQrSrc} alt="QR thanh toán PayOS" className="mx-auto aspect-square w-full max-w-[360px] rounded-2xl object-contain" />
                                    </div>
                                ) : null}
                                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
                                    <p className="text-sm text-white/70">Quét mã QR để thanh toán tự động</p>
                                    <p className="mt-1 text-2xl font-bold text-white">{formatCurrency(payosLink.amount)}</p>
                                </div>
                                <a
                                    href={payosLink.checkoutUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/15 active:bg-white/20"
                                >
                                    Mở trang thanh toán PayOS
                                    <ExternalLink size={16} strokeWidth={1.8} />
                                </a>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-sm text-white/55">
                                {payosLoading ? 'Đang tạo link PayOS...' : payosError ? `PayOS: ${payosError}` : 'Chưa tạo được link PayOS. Dùng QR chuyển khoản bên dưới.'}
                            </div>
                        )}
                    </div>

                    {!payosLink && paymentConfig?.account_no ? (
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
                    ) : !payosLink ? (
                        <div className="bg-red-500/10 rounded-3xl p-8 text-center border border-red-500/30">
                            <p className="text-red-400">Lỗi cấu hình thanh toán. Vui lòng liên hệ admin.</p>
                        </div>
                    ) : null}
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

function OrderSummary({ order, payAmount, isCustomOrder, compact = false }: { order: OrderData; payAmount: number; isCustomOrder: boolean; compact?: boolean }) {
    return (
        <AnimatedSection delay={compact ? 0.05 : 0.1}>
            <div className="bg-[var(--material-panel)] rounded-3xl p-6 md:p-8 mb-6 border border-[var(--border-color)]">
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
                                    <div className="min-w-0 pr-4">
                                        <p className="text-[var(--text-primary)] text-sm font-medium truncate">{item.name}</p>
                                        <p className="text-[var(--text-tertiary)] text-xs">Số lượng: {item.quantity}</p>
                                    </div>
                                    <span className="text-[var(--text-primary)] text-sm font-medium whitespace-nowrap">{formatCurrency(item.total_price || item.unit_price * item.quantity)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="border-t border-[var(--border-color)] pt-4 space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">Tổng cộng</span>
                        <span className="text-[var(--text-primary)] font-semibold">{formatCurrency(order.total)}</span>
                    </div>
                    {isCustomOrder && (
                        <div className="flex justify-between text-sm">
                            <span className="text-[var(--text-secondary)]">Cần thanh toán (đặt cọc 50%)</span>
                            <span className="text-green-400 font-bold">{formatCurrency(payAmount)}</span>
                        </div>
                    )}
                </div>
            </div>
        </AnimatedSection>
    );
}

function OrderAddress({ order }: { order: OrderData }) {
    if (!order.shipping_address) return null;
    const address = order.shipping_address;
    const addressLine = [address.address_line || address.address, address.ward, address.district, address.province || address.city].filter(Boolean).join(', ');

    return (
        <AnimatedSection delay={0.2}>
            <div className="bg-[var(--material-panel)] rounded-3xl p-8 mb-6 border border-[var(--border-color)]">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Địa chỉ giao hàng</h3>
                <div className="text-[var(--text-secondary)] space-y-2">
                    {(address.full_name || address.name) && <p className="font-medium text-[var(--text-primary)] text-base">{address.full_name || address.name}</p>}
                    {address.phone && <p className="text-sm">{address.phone}</p>}
                    {addressLine && <p className="text-sm">{addressLine}</p>}
                </div>
            </div>
        </AnimatedSection>
    );
}

function ActionLinks() {
    return (
        <AnimatedSection delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/account/orders"><Button variant="default" size="lg">Xem đơn hàng của tôi</Button></Link>
                <Link href="/products"><Button variant="secondary" size="lg">Tiếp tục mua sắm</Button></Link>
            </div>
        </AnimatedSection>
    );
}
