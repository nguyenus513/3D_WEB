/**
 * Two-Factor Authentication Setup Component
 *
 * Used in admin settings to enable/disable 2FA.
 * Flow: Setup → Scan QR → Verify → Show Recovery Codes
 */

'use client';

import { useState, useCallback } from 'react';
import { Loader2, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Step = 'idle' | 'scanning' | 'verifying' | 'recovery' | 'enabled';

interface TwoFactorSetupProps {
    isEnabled: boolean;
    onStatusChange?: (enabled: boolean) => void;
}

export default function TwoFactorSetup({ isEnabled, onStatusChange }: TwoFactorSetupProps) {
    const [step, setStep] = useState<Step>(isEnabled ? 'enabled' : 'idle');
    const [qrCode, setQrCode] = useState('');
    const [manualKey, setManualKey] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [disableCode, setDisableCode] = useState('');
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleSetup = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/admin/2fa/setup', {
                method: 'POST',
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to start setup');
                return;
            }

            setQrCode(data.qrCode);
            setManualKey(data.secret);
            setStep('scanning');
        } catch {
            setError('Không thể kết nối');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleVerify = useCallback(async () => {
        if (verifyCode.length !== 6) return;
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/admin/2fa/enable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: verifyCode }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Verification failed');
                return;
            }

            setRecoveryCodes(data.recoveryCodes);
            setStep('recovery');
            onStatusChange?.(true);
        } catch {
            setError('Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    }, [verifyCode, onStatusChange]);

    const handleDisable = useCallback(async () => {
        if (disableCode.length !== 6) return;
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/admin/2fa/disable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: disableCode }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Disable failed');
                return;
            }

            setStep('idle');
            setDisableCode('');
            onStatusChange?.(false);
        } catch {
            setError('Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    }, [disableCode, onStatusChange]);

    const copyRecoveryCodes = useCallback(() => {
        const text = recoveryCodes.join('\n');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [recoveryCodes]);

    return (
        <div>
            {/* Header: Matches Drive Connect Style */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Bảo mật</h2>
                    <p className="text-[var(--text-secondary)] text-sm mt-1">
                        Xác thực 2 yếu tố cho tài khoản admin
                    </p>
                </div>

                {step === 'enabled' || step === 'recovery' ? (
                    <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-medium">
                        Đang bật
                    </span>
                ) : (
                    <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-sm font-medium">
                        Chưa bật
                    </span>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="mt-4 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Content Section */}
            <div className="mt-6 pt-4 border-t border-[var(--border-color)]">

                {/* Case: IDLE */}
                {step === 'idle' && (
                    <div className="flex justify-between items-center">
                        <p className="text-[var(--text-secondary)] text-sm">Tăng cường bảo mật bằng Google Authenticator hoặc Authy.</p>
                        <button
                            onClick={handleSetup}
                            disabled={loading}
                            className="px-6 py-2.5 rounded-xl bg-white text-black font-medium hover:bg-[var(--material-glass)] text-sm transition-colors disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Bật 2FA'}
                        </button>
                    </div>
                )}

                {/* Case: SCANNING */}
                {step === 'scanning' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="bg-white p-4 rounded-xl inline-block h-fit">
                                <img src={qrCode} alt="QR Code" width={160} height={160} className="mix-blend-multiply" />
                            </div>
                            <div className="flex-1 space-y-4">
                                <div>
                                    <h3 className="text-[var(--text-primary)] font-medium mb-1">1. Quét mã QR</h3>
                                    <p className="text-[var(--text-secondary)] text-sm">Mở ứng dụng Authenticator và quét mã này.</p>
                                </div>

                                <div>
                                    <h3 className="text-[var(--text-primary)] font-medium mb-1">2. Nhập mã xác nhận</h3>
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            value={verifyCode}
                                            onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                                            onKeyDown={e => e.key === 'Enter' && handleVerify()}
                                            placeholder="000000"
                                            className="bg-[var(--material-panel)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-center font-mono text-lg tracking-widest w-32 focus:border-blue-500 outline-none text-[var(--text-primary)] transition-colors"
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleVerify}
                                            disabled={loading || verifyCode.length !== 6}
                                            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[var(--text-primary)] font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kích hoạt'}
                                        </button>
                                    </div>
                                </div>

                                <details className="text-sm pt-2">
                                    <summary className="text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors">Không quét được mã?</summary>
                                    <div className="mt-2 p-3 bg-[var(--material-panel)] rounded-lg border border-[var(--border-color)]">
                                        <p className="text-[var(--text-tertiary)] text-xs mb-1">Khóa setup thủ công:</p>
                                        <code className="text-blue-400 font-mono select-all">{manualKey}</code>
                                    </div>
                                </details>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Case: RECOVERY */}
                {step === 'recovery' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl mb-6">
                            <h3 className="text-yellow-400 font-medium mb-1 flex items-center gap-2">
                                ⚠️ Lưu mã khôi phục!
                            </h3>
                            <p className="text-yellow-400/70 text-sm">
                                Nếu mất điện thoại, bạn CHỈ có thể đăng nhập bằng các mã này.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                            {recoveryCodes.map((code, i) => (
                                <code key={i} className="bg-[var(--material-panel)] text-[var(--text-secondary)] font-mono text-sm py-2 px-3 rounded-lg text-center border border-[var(--border-color)]">
                                    {code}
                                </code>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={copyRecoveryCodes}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-color)] hover:bg-[var(--material-glass)] text-[var(--text-primary)] text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                                {copied ? 'Đã copy' : 'Copy tất cả'}
                            </button>
                            <button
                                onClick={() => setStep('enabled')}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-white text-black font-medium hover:bg-[var(--material-glass)] text-sm transition-colors"
                            >
                                Đã lưu xong
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Case: ENABLED */}
                {step === 'enabled' && (
                    <div className="flex justify-between items-center">
                        <p className="text-[var(--text-secondary)] text-sm">
                            Tài khoản đang được bảo vệ.
                        </p>
                        <details className="relative group">
                            <summary className="list-none">
                                <span className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)] text-sm transition-colors cursor-pointer select-none">
                                    Tắt 2FA
                                </span>
                            </summary>

                            <div className="absolute right-0 bottom-full mb-2 w-72 bg-[var(--material-panel)] border border-[var(--border-color)] rounded-xl p-4 shadow-xl z-10">
                                <p className="text-[var(--text-secondary)] text-sm mb-3">Nhập mã OTP để tắt:</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={disableCode}
                                        onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))}
                                        placeholder="000000"
                                        className="bg-[var(--material-panel)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 font-mono text-center w-24 text-[var(--text-primary)] focus:border-red-500 outline-none"
                                    />
                                    <button
                                        onClick={handleDisable}
                                        disabled={loading || disableCode.length !== 6}
                                        className="flex-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        {loading ? '...' : 'Xác nhận tắt'}
                                    </button>
                                </div>
                            </div>
                        </details>
                    </div>
                )}
            </div>
        </div>
    );
}

