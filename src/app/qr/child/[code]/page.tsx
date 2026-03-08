'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { PaymentQR } from '@/components/PaymentQR';
import { BankCode } from '@/lib/vietqr';

interface OrderData {
    id: string;
    code_child: string;
    product_name: string;
    product_type: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    status: string;
    payment_qr_url: string;
    metadata?: {
        shipping_address?: {
            full_name: string;
            phone: string;
            address_line?: string;
            province?: string;
        };
        customer_code?: string;
        transfer_content?: string;
        correlation_id?: string;
        // Bank info stored in metadata
        bank_code?: string;
        account_no?: string;
        account_name?: string;
    };
}

export default function QRChildPage() {
    const params = useParams();
    const code = params.code as string;

    const [order, setOrder] = useState<OrderData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'expired'>('pending');

    useEffect(() => {
        if (!code) return;

        const fetchOrder = async () => {
            try {
                const res = await fetch(`/api/orders/child/${code}`);
                if (!res.ok) throw new Error('Order not found');

                const data = await res.json();
                setOrder(data.order);
                setPaymentStatus(data.order.status);
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();

        // Poll for payment status every 10 seconds
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/webhooks/qr?code=${code}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'paid') {
                        setPaymentStatus('paid');
                        clearInterval(interval);
                    } else if (data.status === 'expired') {
                        setPaymentStatus('expired');
                        clearInterval(interval);
                    }
                }
            } catch (_) {
                // Ignore polling errors
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [code]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-[var(--bg-void)] flex flex-col items-center justify-center text-center px-4">
                <h1 className="text-2xl text-[var(--text-primary)] mb-4">Không tìm thấy đơn hàng</h1>
                <p className="text-[var(--text-secondary)] mb-6">Mã đơn hàng không tồn tại hoặc đã hết hạn</p>
                <Link href="/" className="text-blue-400 hover:underline">Về trang chủ</Link>
            </div>
        );
    }

    const totalWithShipping = order.total_price;

    if (paymentStatus === 'paid') {
        return (
            <div className="min-h-screen bg-[var(--bg-void)] flex flex-col items-center justify-center text-center px-4">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6"
                >
                    <svg className="w-10 h-10 text-[var(--text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </motion.div>
                <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Thanh toán thành công!</h1>
                <p className="text-[var(--text-secondary)] mb-2">Mã đơn hàng: <span className="font-mono text-[var(--text-primary)]">{code}</span></p>
                <p className="text-green-400 text-lg mb-8">{totalWithShipping.toLocaleString('vi-VN')}đ</p>
                <Link
                    href="/account/orders"
                    className="px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-[var(--material-glass)]"
                >
                    Xem đơn hàng của tôi
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-void)] pt-24 pb-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Check if bank info exists in order metadata */}
                {order.metadata?.account_no ? (
                    <PaymentQR
                        orderId={order.id}
                        orderCode={code}
                        customerCode={order.metadata?.customer_code}
                        amount={totalWithShipping}
                        bankId={(order.metadata.bank_code || 'MB') as BankCode}
                        accountNo={order.metadata.account_no}
                        accountName={order.metadata.account_name || 'Chủ tài khoản'}
                        qrUrl={order.payment_qr_url}
                        transferContent={order.metadata?.transfer_content}
                        orderDetails={{
                            productName: order.product_name,
                            productType: order.product_type,
                            quantity: order.quantity,
                            unitPrice: order.unit_price,
                            shippingAddress: order.metadata?.shipping_address,
                        }}
                        onPaymentConfirmed={() => setPaymentStatus('paid')}
                    />
                ) : (
                    <div className="bg-red-500/10 rounded-3xl p-8 text-center border border-red-500/30">
                        <p className="text-red-400 text-lg mb-2">Lỗi cấu hình thanh toán</p>
                        <p className="text-[var(--text-secondary)]">Thông tin ngân hàng không tồn tại trong đơn hàng. Vui lòng liên hệ admin.</p>
                    </div>
                )}

                {/* Back link */}
                <div className="text-center mt-8">
                    <Link href="/" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm">
                        ← Về trang chủ
                    </Link>
                </div>
            </div>
        </div>
    );
}
