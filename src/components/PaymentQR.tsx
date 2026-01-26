'use client';

import { useState, useMemo } from 'react';
import { BANK_INFO, type BankCode } from '@/lib/vietqr';

interface PaymentQRProps {
    orderId: string;
    orderCode: string;
    customerCode?: string;
    amount: number;
    bankId: BankCode;
    accountNo: string;
    accountName: string;
    onPaymentConfirmed?: () => void;
}

export function PaymentQR({
    orderId,
    orderCode,
    customerCode,
    amount,
    bankId,
    accountNo,
    accountName,
    onPaymentConfirmed
}: PaymentQRProps) {
    const [copied, setCopied] = useState<'account' | 'content' | null>(null);
    const [imgError, setImgError] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [isConfirmed, setIsConfirmed] = useState(false);

    const transferContent = `MINWSUN_${orderCode}`;

    // Generate VietQR image URL directly - simple and reliable
    const qrUrl = useMemo(() => {
        const params = new URLSearchParams({
            amount: amount.toString(),
            addInfo: transferContent,
            accountName: accountName.toUpperCase(),
        });
        return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?${params.toString()}`;
    }, [amount, transferContent, accountName, bankId, accountNo]);

    const handleCopy = async (text: string, type: 'account' | 'content') => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(type);
            setTimeout(() => setCopied(null), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
        }).format(value);
    };

    const handleConfirmPayment = async () => {
        setIsConfirming(true);
        setConfirmError(null);

        try {
            const res = await fetch(`/api/orders/${orderId}/payment-confirmation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Không thể xác nhận thanh toán');
            }

            setIsConfirmed(true);
            onPaymentConfirmed?.();
        } catch (err) {
            setConfirmError((err as Error).message);
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <div className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 max-w-md mx-auto">
            {/* Header */}
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white mb-1">Thanh Toán Chuyển Khoản</h2>
                <p className="text-white/50 text-sm">Quét mã QR hoặc chuyển khoản thủ công</p>
            </div>

            {/* QR Code - Direct from VietQR */}
            <div className="bg-white rounded-xl p-4 mb-6">
                {imgError ? (
                    <div className="w-full aspect-square flex flex-col items-center justify-center text-gray-500">
                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-sm text-center">Không thể tải QR</p>
                        <p className="text-xs mt-1">Vui lòng chuyển khoản thủ công</p>
                    </div>
                ) : (
                    <img
                        src={qrUrl}
                        alt="VietQR Payment Code"
                        className="w-full aspect-square object-contain"
                        onError={() => setImgError(true)}
                    />
                )}
                <p className="text-center text-xs text-gray-500 mt-2">Powered by VietQR</p>
            </div>

            {/* Bank Info */}
            <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/50">Ngân hàng</span>
                    <span className="text-white font-medium">{BANK_INFO[bankId].shortName}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/50">Số tài khoản</span>
                    <button
                        onClick={() => handleCopy(accountNo, 'account')}
                        className="flex items-center gap-2 text-white font-mono hover:text-blue-400 transition-colors"
                    >
                        {accountNo}
                        {copied === 'account' ? (
                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        )}
                    </button>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/50">Chủ tài khoản</span>
                    <span className="text-white font-medium">{accountName}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/50">Số tiền</span>
                    <span className="text-green-400 font-bold text-lg">{formatCurrency(amount)}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/50">Nội dung CK</span>
                    <button
                        onClick={() => handleCopy(transferContent, 'content')}
                        className="flex items-center gap-2 text-white font-mono text-sm bg-white/5 px-2 py-1 rounded hover:bg-white/10 transition-colors"
                    >
                        {transferContent}
                        {copied === 'content' ? (
                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* Warning */}
            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <div className="flex gap-3">
                    <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="text-sm">
                        <p className="text-yellow-400 font-medium mb-1">Lưu ý quan trọng</p>
                        <p className="text-yellow-400/70">
                            Vui lòng ghi đúng nội dung chuyển khoản để đơn hàng được xác nhận nhanh nhất.
                        </p>
                    </div>
                </div>
            </div>

            {/* Confirm Payment Button */}
            <div className="mt-6">
                {isConfirmed ? (
                    <div className="flex items-center justify-center gap-2 py-3 px-6 bg-green-500/20 border border-green-500/30 rounded-xl">
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-green-400 font-medium">Đã gửi xác nhận - Chờ Admin kiểm tra</span>
                    </div>
                ) : (
                    <button
                        onClick={handleConfirmPayment}
                        disabled={isConfirming}
                        className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isConfirming ? (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Tôi đã chuyển khoản
                            </>
                        )}
                    </button>
                )}

                {confirmError && (
                    <p className="mt-2 text-center text-red-400 text-sm">{confirmError}</p>
                )}
            </div>

            {/* Status */}
            {!isConfirmed && (
                <div className="mt-4 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                        <span className="text-white/70 text-sm">Đang chờ xác nhận thanh toán...</span>
                    </div>
                </div>
            )}
        </div>
    );
}

