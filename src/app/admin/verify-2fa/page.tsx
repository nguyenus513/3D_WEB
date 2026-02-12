/**
 * 2FA Verification Page
 *
 * Shown to admin users who have 2FA enabled but haven't verified yet.
 * Features 6-digit OTP input with auto-submit and recovery code fallback.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function Verify2FAPage() {
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
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: '#0a0a0a',
                color: '#888',
            }}>
                Đang kiểm tra...
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: '#0a0a0a',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '420px',
                padding: '48px 32px',
                background: '#141414',
                borderRadius: '24px',
                border: '1px solid #222',
                textAlign: 'center',
            }}>
                {/* Shield icon */}
                <div style={{
                    width: '64px',
                    height: '64px',
                    margin: '0 auto 24px',
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                }}>
                    🔐
                </div>

                <h1 style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    color: '#fff',
                    margin: '0 0 8px',
                }}>
                    Xác thực 2 yếu tố
                </h1>

                <p style={{
                    color: '#888',
                    fontSize: '14px',
                    margin: '0 0 32px',
                    lineHeight: 1.5,
                }}>
                    {showRecovery
                        ? 'Nhập recovery code để đăng nhập'
                        : 'Nhập mã 6 chữ số từ ứng dụng Authenticator'
                    }
                </p>

                {!showRecovery ? (
                    <>
                        {/* 6-digit OTP input */}
                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            justifyContent: 'center',
                            marginBottom: '24px',
                        }}>
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
                                    style={{
                                        width: '48px',
                                        height: '56px',
                                        textAlign: 'center',
                                        fontSize: '24px',
                                        fontWeight: 700,
                                        fontFamily: 'monospace',
                                        background: '#1a1a1a',
                                        border: `2px solid ${digit ? '#3b82f6' : '#333'}`,
                                        borderRadius: '12px',
                                        color: '#fff',
                                        outline: 'none',
                                        transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => {
                                        e.target.style.borderColor = '#3b82f6';
                                    }}
                                    onBlur={e => {
                                        e.target.style.borderColor = digit ? '#3b82f6' : '#333';
                                    }}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <div style={{ marginBottom: '24px' }}>
                        <input
                            type="text"
                            placeholder="XXXXX-XXXXX"
                            value={recoveryCode}
                            onChange={e => setRecoveryCode(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleRecoverySubmit()}
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                fontSize: '18px',
                                fontFamily: 'monospace',
                                fontWeight: 600,
                                textAlign: 'center',
                                letterSpacing: '2px',
                                background: '#1a1a1a',
                                border: '2px solid #333',
                                borderRadius: '12px',
                                color: '#fff',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                            autoFocus
                        />
                        <button
                            onClick={handleRecoverySubmit}
                            disabled={loading || !recoveryCode.trim()}
                            style={{
                                width: '100%',
                                marginTop: '12px',
                                padding: '14px',
                                background: loading ? '#333' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '15px',
                                fontWeight: 600,
                                cursor: loading ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {loading ? 'Đang xác thực...' : 'Xác thực'}
                        </button>
                    </div>
                )}

                {/* Error message */}
                {error && (
                    <p style={{
                        color: '#ef4444',
                        fontSize: '13px',
                        margin: '0 0 16px',
                        padding: '10px 16px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: '8px',
                    }}>
                        {error}
                    </p>
                )}

                {/* Loading indicator */}
                {loading && !showRecovery && (
                    <p style={{ color: '#3b82f6', fontSize: '14px', margin: '0 0 16px' }}>
                        Đang xác thực...
                    </p>
                )}

                {/* Toggle recovery */}
                <button
                    onClick={() => {
                        setShowRecovery(!showRecovery);
                        setError('');
                        setRecoveryCode('');
                        setDigits(['', '', '', '', '', '']);
                    }}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#3b82f6',
                        fontSize: '13px',
                        cursor: 'pointer',
                        padding: '8px',
                    }}
                >
                    {showRecovery
                        ? '← Quay lại nhập mã OTP'
                        : 'Dùng recovery code'
                    }
                </button>
            </div>
        </div>
    );
}
