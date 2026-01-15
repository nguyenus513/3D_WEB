'use client';

import { useState } from 'react';
import { generateVietQR, generateTransferContent, formatCurrency, BANK_INFO, type BankCode } from '@/lib/vietqr';

interface PaymentQRProps {
    orderCode: string;
    amount: number;
    bankId: BankCode;
    accountNo: string;
    accountName: string;
}

export function PaymentQR({ orderCode, amount, bankId, accountNo, accountName }: PaymentQRProps) {
    const [copied, setCopied] = useState<'account' | 'content' | null>(null);

    const transferContent = generateTransferContent(orderCode);
    const qrUrl = generateVietQR({
        bankId,
        accountNo,
        accountName,
        amount,
        addInfo: transferContent,
    });

    const handleCopy = async (text: string, type: 'account' | 'content') => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(type);
            setTimeout(() => setCopied(null), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    return (
        <div className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 max-w-md mx-auto">
            {/* Header */}
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white mb-1">Thanh Toán Chuyển Khoản</h2>
                <p className="text-white/50 text-sm">Quét mã QR hoặc chuyển khoản thủ công</p>
            </div>

            {/* QR Code */}
            <div className="bg-white rounded-xl p-4 mb-6">
                <img
                    src={qrUrl}
                    alt="VietQR Payment Code"
                    className="w-full aspect-square object-contain"
                />
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

            {/* Status */}
            <div className="mt-6 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                    <span className="text-white/70 text-sm">Đang chờ xác nhận thanh toán...</span>
                </div>
            </div>
        </div>
    );
}
