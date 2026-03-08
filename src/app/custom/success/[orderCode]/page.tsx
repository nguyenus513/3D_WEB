'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/button';
import { BANK_INFO, type BankCode } from '@/lib/vietqr';

interface OrderData {
    id: string;
    order_code: string;
    cart_code?: string | null;
    order_type: string;
    total: number;
    status: string;
    payment_status: string;
    created_at: string;
    shipping_address?: {
        full_name?: string;
        phone?: string;
        address_line?: string;
        province?: string;
    };
    items?: Array<{ name: string; quantity: number; total_price: number }>; 
    payment?: {
        bank_id?: string;
        account_no?: string;
        account_name?: string;
        transfer_content?: string;
        qr_url?: string;
    };
}

export default function CheckoutSuccessPage() {
    const params = useParams();
    const orderCode = params.orderCode as string;

    const [order, setOrder] = useState<OrderData | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasConfirmedPayment, setHasConfirmedPayment] = useState(false);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const res = await fetch(`/api/orders/lookup?id=${orderCode}`);
                if (!res.ok) throw new Error('Order not found');
                const json = await res.json();
                const data = json.data || json;
                setOrder(data);
                if (data.payment_status === 'paid' || data.deposit_paid) {
                    setHasConfirmedPayment(true);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (orderCode) fetchOrder();
    }, [orderCode]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg-void)] pt-32 pb-20 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-[var(--border-color)] border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[var(--text-secondary)]">Loading...</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-[var(--bg-void)] pt-32 pb-20 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-4">Order not found</p>
                    <Link href="/">
                        <Button variant="secondary">Back to home</Button>
                    </Link>
                </div>
            </div>
        );
    }

    if (!hasConfirmedPayment) {
        const payment = order.payment || {};
        const depositAmount = Math.round(order.total);
        const fallbackContent = order.cart_code || order.order_code;
        const qrUrl = payment.qr_url || `https://img.vietqr.io/image/MB-0359123456-compact2.png?amount=${depositAmount}&addInfo=${encodeURIComponent(fallbackContent)}`;
        const transferContent = payment.transfer_content || fallbackContent;
        const bankName = payment.bank_id ? (BANK_INFO[payment.bank_id as BankCode]?.shortName || payment.bank_id) : 'MB Bank';
        const accountNo = payment.account_no || '0359123456';
        const accountName = payment.account_name || 'MINWSUN';

        return (
            <div className="min-h-screen bg-[var(--bg-void)] pt-28 pb-20">
                <div className="max-w-[600px] mx-auto px-6">
                    <AnimatedSection className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Please Pay</h1>
                        <p className="text-[var(--text-secondary)]">Scan QR to complete the order</p>
                    </AnimatedSection>

                    <AnimatedSection delay={0.1}>
                        <div className="bg-[var(--material-panel)] rounded-3xl p-8 mb-6 border border-[var(--border-color)]">
                            <div className="bg-white rounded-2xl p-4 max-w-[280px] mx-auto mb-8 shadow-2xl">
                                <img src={qrUrl} alt="VietQR Payment" className="w-full aspect-square object-contain" />
                                <p className="text-center text-xs text-gray-500 mt-2 font-medium">Scan to transfer</p>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="bg-[var(--material-glass)] rounded-xl p-4 space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-[var(--text-secondary)]">Bank</span>
                                        <span className="text-[var(--text-primary)] font-medium">{bankName}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-[var(--text-secondary)]">Account</span>
                                        <span className="text-[var(--text-primary)] font-medium">{accountNo}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-[var(--text-secondary)]">Name</span>
                                        <span className="text-[var(--text-primary)] font-medium">{accountName}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-[var(--text-secondary)]">Content</span>
                                        <span className="text-[var(--text-primary)] font-mono">{transferContent}</span>
                                    </div>
                                </div>
                            </div>

                            <Button variant="primary" className="w-full" onClick={() => setHasConfirmedPayment(true)}>
                                I have paid
                            </Button>
                        </div>
                    </AnimatedSection>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-void)] pt-28 pb-20">
            <div className="max-w-[800px] mx-auto px-6">
                <AnimatedSection className="text-center mb-10">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center mx-auto mb-4">
                        ?
                    </div>
                    <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Order placed</h1>
                    <p className="text-[var(--text-secondary)]">Order code: <span className="font-mono text-[var(--text-primary)]">{order.order_code}</span></p>
                </AnimatedSection>

                <div className="bg-[var(--material-panel)] rounded-3xl p-8 border border-[var(--border-color)]">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Order summary</h2>
                    <div className="space-y-3">
                        {(order.items || []).map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                                <span className="text-[var(--text-secondary)]">{item.name}</span>
                                <span className="text-[var(--text-primary)]">x{item.quantity}</span>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-[var(--border-color)] mt-6 pt-4 flex justify-between">
                        <span className="text-[var(--text-secondary)]">Total</span>
                        <span className="text-[var(--text-primary)] font-semibold">{order.total.toLocaleString('vi-VN')}d</span>
                    </div>
                </div>

                <div className="text-center mt-8">
                    <Link href="/account/orders">
                        <Button variant="secondary">View orders</Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
