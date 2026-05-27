'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

function Verify2FAContent() {
    const router = useRouter();
    const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showRecovery, setShowRecovery] = useState(false);
    const [recoveryCode, setRecoveryCode] = useState('');
    const [checking, setChecking] = useState(true);
    const [canLaunch, setCanLaunch] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        let cancelled = false;

        async function check2FAStatus() {
            try {
                const res = await fetch('/api/admin/2fa/status', { cache: 'no-store' });
                if (cancelled) return;

                if (res.status === 401) {
                    router.replace('/login?callbackUrl=/admin/verify-2fa');
                    return;
                }

                if (!res.ok) {
                    setError('Không kiểm tra được trạng thái 2FA. Vui lòng thử lại.');
                    setChecking(false);
                    return;
                }

                const data = await res.json();
                if (!data.enabled || data.verified) {
                    setCanLaunch(true);
                    setChecking(false);
                    return;
                }

                setChecking(false);
            } catch {
                if (!cancelled) {
                    setError('Không kết nối được máy chủ xác thực.');
                    setChecking(false);
                }
            }
        }

        check2FAStatus();
        return () => { cancelled = true; };
    }, [router]);

    useEffect(() => {
        if (!checking && !canLaunch && !showRecovery) inputRefs.current[0]?.focus();
    }, [checking, canLaunch, showRecovery]);

    useEffect(() => {
        if (!canLaunch) return;
        const timeout = window.setTimeout(() => {
            window.location.replace('/api/admin/launch');
        }, 250);
        return () => window.clearTimeout(timeout);
    }, [canLaunch]);

    const launchAdmin = useCallback(() => {
        window.location.assign('/api/admin/launch');
    }, []);

    const handleVerify = useCallback(async (code: string) => {
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/admin/2fa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: code }),
            });
            const data = await res.json().catch(() => ({}));

            if (data.success) {
                launchAdmin();
                return;
            }

            setError(data.error || 'Mã không chính xác');
            setDigits(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } catch {
            setError('Có lỗi xảy ra. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }, [launchAdmin]);

    const handleDigitChange = useCallback((index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const nextDigits = [...digits];
        nextDigits[index] = value.slice(-1);
        setDigits(nextDigits);
        if (value && index < 5) inputRefs.current[index + 1]?.focus();
        if (value && index === 5) {
            const code = nextDigits.join('');
            if (code.length === 6) handleVerify(code);
        }
    }, [digits, handleVerify]);

    const handleKeyDown = useCallback((index: number, event: React.KeyboardEvent) => {
        if (event.key === 'Backspace' && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
    }, [digits]);

    const handlePaste = useCallback((event: React.ClipboardEvent) => {
        event.preventDefault();
        const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
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
            const data = await res.json().catch(() => ({}));

            if (data.success) {
                launchAdmin();
                return;
            }

            setError(data.error || 'Recovery code không hợp lệ');
        } catch {
            setError('Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    }, [launchAdmin, recoveryCode]);

    if (checking) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--bg-void)] text-[var(--text-secondary)]">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    if (canLaunch) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--bg-void)] font-sans selection:bg-white/20">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-3xl border border-[var(--border-color)] bg-[var(--material-panel)] p-8 text-center shadow-2xl sm:p-10">
                    <div className="mb-8 flex justify-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--material-glass)] text-[var(--text-primary)] ring-1 ring-white/10">
                            <ShieldCheck size={32} strokeWidth={1.5} />
                        </div>
                    </div>
                    <h1 className="mb-3 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Đã xác thực admin</h1>
                    <p className="mb-8 text-sm text-[var(--text-secondary)]">Bấm để mở trang quản trị. Trang user sẽ không tự chuyển sang admin nữa.</p>
                    <button onClick={launchAdmin} className="w-full rounded-xl bg-white py-3.5 font-medium text-black transition-all hover:bg-neutral-200 active:scale-[0.98]">
                        Vào admin
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-void)] font-sans selection:bg-white/20">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="w-full max-w-md rounded-3xl border border-[var(--border-color)] bg-[var(--material-panel)] p-8 shadow-2xl sm:p-10">
                <div className="mb-8 flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--material-glass)] text-[var(--text-primary)] ring-1 ring-white/10">
                        <ShieldCheck size={32} strokeWidth={1.5} />
                    </div>
                </div>

                <div className="mb-8 text-center">
                    <h1 className="mb-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Xác thực 2 yếu tố</h1>
                    <p className="text-sm text-[var(--text-secondary)]">
                        {showRecovery ? 'Nhập mã khôi phục để đăng nhập' : 'Nhập mã 6 chữ số từ ứng dụng xác thực'}
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {!showRecovery ? (
                        <motion.div key="otp" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                            <div className="mb-8 flex justify-center gap-3">
                                {digits.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(element) => { inputRefs.current[index] = element; }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(event) => handleDigitChange(index, event.target.value)}
                                        onKeyDown={(event) => handleKeyDown(index, event)}
                                        onPaste={index === 0 ? handlePaste : undefined}
                                        disabled={loading}
                                        className={`h-14 w-12 rounded-xl border-2 bg-[var(--bg-void)] text-center font-mono text-2xl font-bold outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${digit ? 'border-white text-[var(--text-primary)]' : 'border-[var(--border-color)] text-[var(--text-secondary)] focus:border-white/60 focus:text-[var(--text-primary)]'}`}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="recovery" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="mb-8">
                            <input
                                type="text"
                                placeholder="XXXXX-XXXXX"
                                value={recoveryCode}
                                onChange={(event) => setRecoveryCode(event.target.value)}
                                onKeyDown={(event) => event.key === 'Enter' && handleRecoverySubmit()}
                                disabled={loading}
                                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-void)] px-4 py-3.5 text-center font-mono text-lg font-medium tracking-widest text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-white/60"
                                autoFocus
                            />
                            <button onClick={handleRecoverySubmit} disabled={loading || !recoveryCode.trim()} className="mt-4 w-full rounded-xl bg-white py-3.5 font-medium text-black transition-all hover:bg-neutral-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
                                {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Đang xử lý...</span> : 'Xác thực'}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {error && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400">{error}</motion.div>}
                {loading && !showRecovery && <div className="mb-6 flex justify-center text-[var(--text-primary)]"><Loader2 className="h-5 w-5 animate-spin" /></div>}

                <div className="text-center">
                    <button
                        onClick={() => {
                            setShowRecovery(!showRecovery);
                            setError('');
                            setRecoveryCode('');
                            setDigits(['', '', '', '', '', '']);
                        }}
                        className="group mx-auto flex items-center gap-2 text-sm text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
                    >
                        {showRecovery ? <><ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />Quay lại nhập mã OTP</> : 'Không có thiết bị? Dùng mã khôi phục'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

export default function Verify2FAPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[var(--bg-void)]"><Loader2 className="h-6 w-6 animate-spin text-[var(--text-tertiary)]" /></div>}>
            <Verify2FAContent />
        </Suspense>
    );
}
