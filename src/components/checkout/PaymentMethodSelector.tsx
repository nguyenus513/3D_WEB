'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PaymentMethodProps {
    amount: number;
    orderId: string;
    onSuccess: (paymentId: string) => void;
    onError: (error: string) => void;
}

type PaymentMethod = 'card' | 'bank';

const CardIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
);

const BankIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
);

const CheckIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
);

export function PaymentMethodSelector({
    amount,
    orderId,
    onSuccess,
    onError,
}: PaymentMethodProps) {
    const [method, setMethod] = useState<PaymentMethod>('bank');
    const [loading, setLoading] = useState(false);
    const [bankInfo, setBankInfo] = useState<{
        bankName: string;
        accountNumber: string;
        accountName: string;
        transferContent: string;
        qrCodeUrl: string;
    } | null>(null);

    useEffect(() => {
        if (method === 'bank' && !bankInfo && orderId) {
            loadBankInfo();
        }
    }, [method, orderId]);

    const loadBankInfo = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'bank-transfer',
                    orderId,
                    amount,
                }),
            });

            const data = await res.json();
            if (data.success) {
                setBankInfo(data.data);
            } else {
                onError(data.error || 'Không thể tải thông tin chuyển khoản');
            }
        } catch {
            onError('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    };

    const handleCardPayment = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, amount }),
            });

            const data = await res.json();
            if (data.success && data.clientSecret) {
                onSuccess(data.paymentIntentId);
            } else {
                onError(data.error || 'Không thể khởi tạo thanh toán');
            }
        } catch {
            onError('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => setMethod('bank')}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ${method === 'bank'
                            ? 'border-green-500 bg-green-500/10'
                            : 'border-[var(--border-color)] bg-[var(--material-glass)] hover:bg-[var(--material-glass)]'
                        }`}
                >
                    <div className={method === 'bank' ? 'text-green-400' : 'text-[var(--text-secondary)]'}>
                        <BankIcon />
                    </div>
                    <div className="text-left">
                        <p className={`font-medium ${method === 'bank' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                            Chuyển khoản
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">QR Code ngân hàng</p>
                    </div>
                    {method === 'bank' && (
                        <div className="ml-auto text-green-400">
                            <CheckIcon />
                        </div>
                    )}
                </button>

                <button
                    onClick={() => setMethod('card')}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ${method === 'card'
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-[var(--border-color)] bg-[var(--material-glass)] hover:bg-[var(--material-glass)]'
                        }`}
                >
                    <div className={method === 'card' ? 'text-blue-400' : 'text-[var(--text-secondary)]'}>
                        <CardIcon />
                    </div>
                    <div className="text-left">
                        <p className={`font-medium ${method === 'card' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                            Thẻ tín dụng
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">Visa, Mastercard</p>
                    </div>
                    {method === 'card' && (
                        <div className="ml-auto text-blue-400">
                            <CheckIcon />
                        </div>
                    )}
                </button>
            </div>

            <AnimatePresence mode="wait">
                {method === 'bank' && (
                    <motion.div
                        key="bank"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-[var(--material-panel)] rounded-xl p-5"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-white rounded-full animate-spin" />
                            </div>
                        ) : bankInfo ? (
                            <div className="space-y-4">
                                <div className="flex justify-center">
                                    <div className="bg-white p-3 rounded-xl">
                                        <img
                                            src={bankInfo.qrCodeUrl}
                                            alt="VietQR"
                                            className="w-48 h-48"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-[var(--text-secondary)]">Ngân hàng</span>
                                        <span className="text-[var(--text-primary)] font-medium">{bankInfo.bankName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[var(--text-secondary)]">Số tài khoản</span>
                                        <span className="text-[var(--text-primary)] font-mono">{bankInfo.accountNumber}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[var(--text-secondary)]">Chủ tài khoản</span>
                                        <span className="text-[var(--text-primary)] font-medium">{bankInfo.accountName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[var(--text-secondary)]">Nội dung CK</span>
                                        <span className="text-yellow-400 font-mono font-bold">
                                            {bankInfo.transferContent}
                                        </span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-[var(--border-color)]">
                                        <span className="text-[var(--text-secondary)]">Số tiền</span>
                                        <span className="text-green-400 font-bold text-lg">
                                            {amount.toLocaleString('vi-VN')} VND
                                        </span>
                                    </div>
                                </div>

                                <p className="text-xs text-[var(--text-tertiary)] text-center">
                                    Quét mã QR hoặc chuyển khoản thủ công. Đơn hàng sẽ được xác nhận sau khi thanh toán.
                                </p>
                            </div>
                        ) : (
                            <p className="text-[var(--text-secondary)] text-center py-4">Không thể tải thông tin</p>
                        )}
                    </motion.div>
                )}

                {method === 'card' && (
                    <motion.div
                        key="card"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-[var(--material-panel)] rounded-xl p-5"
                    >
                        <div className="space-y-4">
                            <p className="text-[var(--text-secondary)] text-sm text-center">
                                Bạn sẽ được chuyển đến trang thanh toán bảo mật của Stripe
                            </p>

                            <button
                                onClick={handleCardPayment}
                                disabled={loading}
                                className="w-full py-4 rounded-xl border border-white/70 bg-white text-black font-semibold transition-colors hover:bg-white/85 active:bg-white/75 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                        Đang xử lý...
                                    </span>
                                ) : (
                                    `Thanh toán ${amount.toLocaleString('vi-VN')} VND`
                                )}
                            </button>

                            <div className="flex items-center justify-center gap-4 text-[var(--text-tertiary)]">
                                <span className="text-xs">Được bảo vệ bởi</span>
                                <svg className="h-5" viewBox="0 0 60 25" fill="currentColor">
                                    <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.02 1.04-.06 1.48zm-3.67-3.42c0-1.34-.65-3.08-2.2-3.08-1.6 0-2.35 1.76-2.47 3.08h4.67z" />
                                </svg>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

