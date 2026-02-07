'use client';

import { useState } from 'react';
import { BANK_INFO, type BankCode } from '@/lib/vietqr';

interface PaymentQRProps {
    orderId: string;
    orderCode: string;
    cartCode?: string;      // NEW: 8-char cart code for display
    customerCode?: string;
    amount: number;
    // Bank info - now all optional, will use from these props or fallback
    bankId?: BankCode;
    accountNo?: string;
    accountName?: string;
    bankName?: string;
    // Pre-generated QR URL and transfer content from DB
    qrUrl?: string;
    transferContent?: string;
    // Order details for left side
    orderDetails?: {
        productName?: string;
        productType?: string;
        quantity?: number;
        unitPrice?: number;
        shippingAddress?: {
            full_name: string;
            phone: string;
            address_line?: string;
            province?: string;
        };
    };
    onPaymentConfirmed?: () => Promise<void> | void;
}

export function PaymentQR({
    orderId,
    orderCode,
    cartCode,
    customerCode,
    amount,
    bankId = 'MB',
    accountNo = '',
    accountName = '',
    bankName,
    qrUrl: providedQrUrl,
    transferContent: providedTransferContent,
    orderDetails,
    onPaymentConfirmed
}: PaymentQRProps) {
    const [copied, setCopied] = useState<'account' | 'content' | null>(null);
    const [imgError, setImgError] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [isConfirmed, setIsConfirmed] = useState(false);

    // Use provided transfer content, or cartCode (preferred), or fallback to first 8 chars of orderCode
    const displayCode = cartCode || orderCode.substring(0, 8).toUpperCase();
    const transferContent = providedTransferContent || displayCode;

    // Use provided QR URL from DB or generate dynamic VietQR URL
    const qrUrl = providedQrUrl || `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(accountName)}`;

    // Get bank display name
    const displayBankName = bankName || BANK_INFO[bankId]?.shortName || bankId;

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

    // Debug logging
    // console.log('PaymentQR Props:', { orderId, hasHandler: !!onPaymentConfirmed });

    const handleConfirmPayment = async () => {
        setIsConfirming(true);
        setConfirmError(null);

        try {
            // Safety check: specific ID 'cart-placeholder' MUST have a handler
            if (orderId === 'cart-placeholder' && !onPaymentConfirmed) {
                console.error('Critical: Cart placeholder ID but no handler provided!');
                throw new Error('Lỗi hệ thống: Không tìm thấy trình xử lý thanh toán giỏ hàng');
            }

            if (onPaymentConfirmed) {
                // If custom handler provided, use it (e.g. for Cart checkout)
                await onPaymentConfirmed();
                setIsConfirmed(true);
            } else {
                // Default handler for existing orders
                // Extra safety: Prevent fetching if ID looks like a placeholder
                if (orderId.includes('placeholder')) {
                    throw new Error('Invalid Order ID for payment confirmation');
                }

                const res = await fetch(`/api/orders/${orderId}/payment-confirmation`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Không thể xác nhận thanh toán');
                }

                setIsConfirmed(true);
            }
        } catch (err) {
            console.error('Confirm Payment Error:', err);
            setConfirmError((err as Error).message);
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <div className="bg-[#1D1D1F] rounded-3xl border border-white/10 overflow-hidden">
            {/* Apple Store Style - Single Column for Sidebar/Modal adaptability */}
            <div className="flex flex-col">

                {/* LEFT SIDE - Order Details */}
                <div className="p-8 border-b border-white/10">
                    {/* Header */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-semibold text-white mb-1">Thanh Toán</h2>
                        <p className="text-white/50 text-sm">Mã đơn: <span className="font-mono text-white/70">{displayCode}</span></p>
                    </div>

                    {/* Order Summary */}
                    {orderDetails && (
                        <div className="mb-8">
                            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-4">Chi tiết đơn hàng</h3>
                            <div className="space-y-4">
                                {orderDetails.productName && (
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-white font-medium">{orderDetails.productName}</p>
                                            {orderDetails.productType && (
                                                <p className="text-white/50 text-sm capitalize">{orderDetails.productType}</p>
                                            )}
                                        </div>
                                        {orderDetails.quantity && orderDetails.unitPrice && (
                                            <div className="text-right">
                                                <p className="text-white">{formatCurrency(orderDetails.unitPrice)}</p>
                                                <p className="text-white/50 text-sm">x{orderDetails.quantity}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Shipping Address */}
                    {orderDetails?.shippingAddress && (
                        <div className="mb-8">
                            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-4">Giao hàng đến</h3>
                            <div className="bg-white/5 rounded-2xl p-4">
                                <p className="text-white font-medium">{orderDetails.shippingAddress.full_name}</p>
                                <p className="text-white/70 text-sm mt-1">{orderDetails.shippingAddress.phone}</p>
                                {orderDetails.shippingAddress.address_line && (
                                    <p className="text-white/50 text-sm mt-1">
                                        {orderDetails.shippingAddress.address_line}
                                        {orderDetails.shippingAddress.province && `, ${orderDetails.shippingAddress.province}`}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Price Breakdown */}
                    <div className="border-t border-white/10 pt-6">
                        <div className="space-y-3">
                            {orderDetails?.unitPrice && orderDetails?.quantity && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-white/50">Tạm tính</span>
                                    <span className="text-white">{formatCurrency(orderDetails.unitPrice * orderDetails.quantity)}</span>
                                </div>
                            )}
                            {/* Shipping fee section removed - user doesn't need it */}
                            <div className="flex justify-between pt-3 border-t border-white/10">
                                <span className="text-white font-medium">Tổng cộng</span>
                                <span className="text-2xl font-bold text-white">{formatCurrency(amount)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDE - QR Code & Bank Info */}
                <div className="p-8 bg-gradient-to-br from-white/[0.02] to-transparent">
                    {/* QR Code */}
                    <div className="text-center mb-8">
                        <div className="bg-white rounded-2xl p-5 inline-block shadow-2xl">
                            {imgError || !qrUrl ? (
                                <div className="w-64 h-64 flex flex-col items-center justify-center text-gray-400">
                                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <p className="text-xs">Không thể tải QR</p>
                                </div>
                            ) : (
                                <img
                                    src={qrUrl}
                                    alt="VietQR Payment"
                                    className="w-64 h-64 object-contain"
                                    onError={() => setImgError(true)}
                                />
                            )}
                        </div>
                        <p className="text-white/30 text-xs mt-3">Quét mã để thanh toán tự động</p>
                    </div>

                    {/* Bank Info - Dynamic from props */}
                    <div className="space-y-4 mb-8">
                        <div className="flex justify-between items-center py-3 border-b border-white/10">
                            <span className="text-white/50 text-sm">Ngân hàng</span>
                            <span className="text-white font-medium">{displayBankName}</span>
                        </div>

                        <div className="flex justify-between items-center py-3 border-b border-white/10">
                            <span className="text-white/50 text-sm">Số tài khoản</span>
                            <button
                                onClick={() => handleCopy(accountNo, 'account')}
                                className="flex items-center gap-2 text-white font-mono text-sm hover:text-blue-400 transition-colors"
                            >
                                {accountNo}
                                {copied === 'account' ? (
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        <div className="flex justify-between items-center py-3 border-b border-white/10">
                            <span className="text-white/50 text-sm">Chủ tài khoản</span>
                            <span className="text-white font-medium">{accountName}</span>
                        </div>

                        <div className="flex justify-between items-center py-3 border-b border-white/10">
                            <span className="text-white/50 text-sm">Nội dung CK</span>
                            <button
                                onClick={() => handleCopy(transferContent, 'content')}
                                className="flex items-center gap-2 text-white font-mono text-xs bg-white/5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                {transferContent}
                                {copied === 'content' ? (
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Button */}
                    {isConfirmed ? (
                        <div className="flex items-center justify-center gap-2 py-4 px-6 bg-green-500/20 border border-green-500/30 rounded-2xl">
                            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-green-400 font-medium">Đã gửi xác nhận</span>
                        </div>
                    ) : (
                        <button
                            onClick={handleConfirmPayment}
                            disabled={isConfirming}
                            className="w-full py-4 px-6 bg-white text-black font-semibold rounded-2xl hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Tôi đã chuyển khoản
                                </>
                            )}
                        </button>
                    )}

                    {confirmError && (
                        <p className="mt-3 text-center text-red-400 text-sm">{confirmError}</p>
                    )}

                    {/* Warning */}
                    <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                        <p className="text-yellow-400/80 text-xs text-center">
                            ⚠️ Nhập đúng nội dung CK để xác nhận tự động
                        </p>
                    </div>

                    {/* Status */}
                    {!isConfirmed && (
                        <div className="mt-4 text-center">
                            <div className="inline-flex items-center gap-2">
                                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                                <span className="text-white/40 text-xs">Đang chờ thanh toán...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
