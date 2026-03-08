/**
 * 2FA Verification Page
 *
 * Shown to admin users who have 2FA enabled but haven't verified yet.
 * Features 6-digit OTP input with auto-submit and recovery code fallback.
 */

'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function Verify2FAContent() {
    const router = useRouter();
    const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showRecovery, setShowRecovery] = useState(false);
    const [recoveryCode, setRecoveryCode] = useState('');
    const [checking, setChecking] = useState(true);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Check if 2FA is actually needed
    useEffect(() => {
        async function check2FAStatus() {
            try {
                const res = await fetch('/api/admin/2fa/status');
                if (res.status === 401 || res.status === 403) {
                    router.push('/login');
                    return;
                }

                const data = await res.json();
                if (!data.enabled) {
                    // 2FA not enabled — redirect to admin
                    router.push('/sys_internal');
                    return;
                }

                setChecking(false);
            } catch {
                setChecking(false);
            }
        }
        check2FAStatus();
    }, [router]);

    // Auto-focus first input
    useEffect(() => {
        if (!checking && !showRecovery) {
            inputRefs.current[0]?.focus();
        }
    }, [checking, showRecovery]);

    const handleVerify = useCallback(async (code: string) => {
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/admin/2fa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: code }),
            });

            const data = await res.json();

            if (data.success) {
                router.push('/sys_internal');
            } else {
                setError(data.error || 'Mã không chính xác');
                setDigits(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
            }
        } catch {
            setError('Có lỗi xảy ra. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }, [router]);

    const handleDigitChange = useCallback((index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newDigits = [...digits];
        newDigits[index] = value.slice(-1);
        setDigits(newDigits);

        // Auto-advance
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits entered
        if (value && index === 5) {
            const code = newDigits.join('');
            if (code.length === 6) {
                handleVerify(code);
            }
        }
    }, [digits, handleVerify]);

    const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    }, [digits]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            setDigits(pasted.split(''));
            handleVerify(pasted);
        }
    }, [handleVerify]);

    const handleRecoverySubmit = useCallback(async () => {
        if (!recoveryCode.trim()) return;
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/admin/2fa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recoveryCode: recoveryCode.trim() }),
            });

            const data = await res.json();

            if (data.success) {
                router.push('/sys_internal');
            } else {
                setError(data.error || 'Recovery code không hợp lệ');
            }
        } catch {
            setError('Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    }, [recoveryCode, router]);

    if (checking) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[var(--bg-void)] text-[var(--text-secondary)]">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-[var(--bg-void)] font-sans selection:bg-blue-500/30">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-md p-8 sm:p-10 bg-[var(--material-panel)] rounded-3xl border border-[var(--border-color)] shadow-2xl"
            >
                {/* Minimalist Flat Icon */}
                <div className="flex justify-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-[var(--material-glass)] flex items-center justify-center text-blue-500 ring-1 ring-white/10">
                        <ShieldCheck size={32} strokeWidth={1.5} />
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2 tracking-tight">
                        Xác thực 2 yếu tố
                    </h1>
                    <p className="text-[var(--text-secondary)] text-sm">
                        {showRecovery
                            ? 'Nhập mã khôi phục để đăng nhập'
                            : 'Nhập mã 6 chữ số từ ứng dụng xác thực'
                        }
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {!showRecovery ? (
                        <motion.div
                            key="otp"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className="flex gap-3 justify-center mb-8">
                                {digits.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={el => { inputRefs.current[i] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={e => handleDigitChange(i, e.target.value)}
                                        onKeyDown={e => handleKeyDown(i, e)}
                                        onPaste={i === 0 ? handlePaste : undefined}
                                        disabled={loading}
                                        className={`
                                            w-12 h-14 text-center text-2xl font-bold font-mono bg-[var(--bg-void)] 
                                            border-2 rounded-xl outline-none transition-all duration-200
                                            ${digit
                                                ? 'border-blue-500 text-[var(--text-primary)] shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                                                : 'border-[var(--border-color)] text-[var(--text-secondary)] focus:border-blue-500/50 focus:text-[var(--text-primary)]'
                                            }
                                            disabled:opacity-50 disabled:cursor-not-allowed
                                        `}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="recovery"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                            className="mb-8"
                        >
                            <input
                                type="text"
                                placeholder="XXXXX-XXXXX"
                                value={recoveryCode}
                                onChange={e => setRecoveryCode(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleRecoverySubmit()}
                                disabled={loading}
                                className="w-full px-4 py-3.5 text-lg font-mono font-medium text-center tracking-widest bg-[var(--bg-void)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] outline-none focus:border-blue-500/50 transition-colors placeholder:text-[var(--text-tertiary)]"
                                autoFocus
                            />
                            <button
                                onClick={handleRecoverySubmit}
                                disabled={loading || !recoveryCode.trim()}
                                className="w-full mt-4 py-3.5 bg-blue-600 hover:bg-blue-500 text-[var(--text-primary)] font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 active:scale-[0.98]"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Đang xử lý...
                                    </span>
                                ) : 'Xác thực'}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center"
                    >
                        {error}
                    </motion.div>
                )}

                {loading && !showRecovery && (
                    <div className="flex justify-center mb-6 text-blue-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                )}

                <div className="text-center">
                    <button
                        onClick={() => {
                            setShowRecovery(!showRecovery);
                            setError('');
                            setRecoveryCode('');
                            setDigits(['', '', '', '', '', '']);
                        }}
                        className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-sm transition-colors flex items-center gap-2 mx-auto group"
                    >
                        {showRecovery ? (
                            <>
                                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                                Quay lại nhập mã OTP
                            </>
                        ) : 'Không có thiết bị? Dùng mã khôi phục'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

export default function Verify2FAPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-[var(--bg-void)]">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--text-tertiary)]" />
            </div>
        }>
            <Verify2FAContent />
        </Suspense>
    );
}
