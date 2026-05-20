'use client';

import { useState } from 'react';
import { BANK_INFO, type BankCode } from '@/lib/vietqr-public';

interface PaymentQRProps {
    orderId: string;
    orderCode: string;
    cartCode?: string;
    customerCode?: string;
    amount: number;
    bankId?: BankCode;
    accountNo?: string;
    accountName?: string;
    bankName?: string;
    qrUrl?: string;
    transferContent?: string;
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
    amount,
    bankId = 'MB',
    accountNo = '',
    accountName = '',
    bankName,
    qrUrl: providedQrUrl,
    transferContent: providedTransferContent,
    orderDetails,
    onPaymentConfirmed,
}: PaymentQRProps) {
    const [copied, setCopied] = useState<'account' | 'content' | null>(null);
    const [imgError, setImgError] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [isConfirmed, setIsConfirmed] = useState(false);

    const displayCode = cartCode || orderCode.substring(0, 8).toUpperCase();
    const transferContent = providedTransferContent || displayCode;
    const qrUrl = providedQrUrl || `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(accountName)}`;
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

    const formatCurrency = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

    const handleConfirmPayment = async () => {
        setIsConfirming(true);
        setConfirmError(null);
        try {
            if (orderId.includes('placeholder')) throw new Error('Lỗi hệ thống: Mã đơn hàng không hợp lệ');
            const res = await fetch(`/api/orders/${orderId}/payment-confirmation`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Không thể xác nhận thanh toán');
            }
            setIsConfirmed(true);
            await onPaymentConfirmed?.();
        } catch (err) {
            console.error('Confirm Payment Error:', err);
            setConfirmError((err as Error).message);
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <div className="bg-[var(--material-panel)] rounded-3xl border border-[var(--border-color)] overflow-hidden">
            <div className="flex flex-col">
                <div className="p-8 border-b border-[var(--border-color)]">
                    <div className="mb-8">
                        <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-1">Thanh toán</h2>
                        <p className="text-[var(--text-secondary)] text-sm">Mã đơn: <span className="font-mono text-[var(--text-secondary)]">{displayCode}</span></p>
                    </div>

                    {orderDetails?.productName && (
                        <div className="mb-8">
                            <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-4">Chi tiết đơn hàng</h3>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[var(--text-primary)] font-medium">{orderDetails.productName}</p>
                                    {orderDetails.productType && <p className="text-[var(--text-secondary)] text-sm capitalize">{orderDetails.productType}</p>}
                                </div>
                                {orderDetails.quantity && orderDetails.unitPrice && (
                                    <div className="text-right">
                                        <p className="text-[var(--text-primary)]">{formatCurrency(orderDetails.unitPrice)}</p>
                                        <p className="text-[var(--text-secondary)] text-sm">x{orderDetails.quantity}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {orderDetails?.shippingAddress && (
                        <div className="mb-8">
                            <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-4">Giao hàng đến</h3>
                            <div className="bg-[var(--material-glass)] rounded-2xl p-4">
                                <p className="text-[var(--text-primary)] font-medium">{orderDetails.shippingAddress.full_name}</p>
                                <p className="text-[var(--text-secondary)] text-sm mt-1">{orderDetails.shippingAddress.phone}</p>
                                {orderDetails.shippingAddress.address_line && (
                                    <p className="text-[var(--text-secondary)] text-sm mt-1">
                                        {orderDetails.shippingAddress.address_line}{orderDetails.shippingAddress.province && `, ${orderDetails.shippingAddress.province}`}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="border-t border-[var(--border-color)] pt-6">
                        <div className="flex justify-between pt-3 border-t border-[var(--border-color)]">
                            <span className="text-[var(--text-primary)] font-medium">Tổng cộng</span>
                            <span className="text-2xl font-bold text-[var(--text-primary)]">{formatCurrency(amount)}</span>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-gradient-to-br from-white/[0.02] to-transparent">
                    <div className="text-center mb-8">
                        <div className="bg-white rounded-2xl p-5 inline-block shadow-2xl">
                            {imgError || !qrUrl ? (
                                <div className="w-64 h-64 flex flex-col items-center justify-center text-gray-400">
                                    <span className="text-sm">Không tải được mã QR</span>
                                </div>
                            ) : (
                                <img src={qrUrl} alt="Mã QR thanh toán" className="w-64 h-64 object-contain" onError={() => setImgError(true)} />
                            )}
                        </div>
                        <p className="text-[var(--text-secondary)] text-sm mt-4">Quét mã để thanh toán tự động</p>
                    </div>

                    <div className="bg-[var(--material-glass)] rounded-2xl p-5 mb-6 space-y-1">
                        <InfoRow label="Ngân hàng" value={displayBankName} />
                        <InfoButton label="Số tài khoản" value={accountNo} copied={copied === 'account'} onClick={() => handleCopy(accountNo, 'account')} />
                        <InfoRow label="Chủ tài khoản" value={accountName} />
                        <InfoButton label="Nội dung CK" value={transferContent} copied={copied === 'content'} onClick={() => handleCopy(transferContent, 'content')} compact />
                    </div>

                    {isConfirmed ? (
                        <div className="flex items-center justify-center gap-2 py-4 px-6 bg-green-500/20 border border-green-500/30 rounded-2xl">
                            <span className="text-green-400 font-medium">Đã gửi xác nhận</span>
                        </div>
                    ) : (
                        <button onClick={handleConfirmPayment} disabled={isConfirming} className="w-full py-4 px-6 bg-white text-black font-semibold rounded-2xl hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                            {isConfirming ? 'Đang xử lý...' : 'Tôi đã chuyển khoản'}
                        </button>
                    )}

                    {confirmError && <p className="mt-3 text-center text-red-400 text-sm">{confirmError}</p>}

                    <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                        <p className="text-yellow-400/80 text-xs text-center">⚠️ Nhập đúng nội dung CK để xác nhận tự động</p>
                    </div>

                    {!isConfirmed && (
                        <div className="mt-4 text-center">
                            <div className="inline-flex items-center gap-2">
                                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                                <span className="text-[var(--text-tertiary)] text-xs">Đang chờ thanh toán...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center py-3 border-b border-[var(--border-color)] last:border-b-0">
            <span className="text-[var(--text-secondary)] text-sm">{label}</span>
            <span className="text-[var(--text-primary)] font-medium">{value}</span>
        </div>
    );
}

function InfoButton({ label, value, copied, onClick, compact = false }: { label: string; value: string; copied: boolean; onClick: () => void; compact?: boolean }) {
    return (
        <div className="flex justify-between items-center py-3 border-b border-[var(--border-color)] last:border-b-0">
            <span className="text-[var(--text-secondary)] text-sm">{label}</span>
            <button onClick={onClick} className={`flex items-center gap-2 text-[var(--text-primary)] font-mono ${compact ? 'text-xs' : 'text-sm'} hover:text-blue-400 transition-colors`}>
                {value}
                <span className="text-xs text-green-400">{copied ? 'Đã copy' : 'Copy'}</span>
            </button>
        </div>
    );
}