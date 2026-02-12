/**
 * Two-Factor Authentication Setup Component
 *
 * Used in admin settings to enable/disable 2FA.
 * Flow: Setup → Scan QR → Verify → Show Recovery Codes
 */

'use client';

import { useState, useCallback } from 'react';

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
    }, [recoveryCodes]);

    // ─── Styles ─────────────────────────────────────────────────

    const cardStyle: React.CSSProperties = {
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: '16px',
        padding: '24px',
    };

    const btnPrimary: React.CSSProperties = {
        padding: '12px 24px',
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        color: '#fff',
        border: 'none',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
    };

    const btnDanger: React.CSSProperties = {
        ...btnPrimary,
        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    };

    const inputStyle: React.CSSProperties = {
        padding: '12px 16px',
        background: '#111',
        border: '2px solid #333',
        borderRadius: '10px',
        color: '#fff',
        fontSize: '18px',
        fontFamily: 'monospace',
        fontWeight: 600,
        textAlign: 'center',
        letterSpacing: '4px',
        width: '200px',
        outline: 'none',
    };

    // ─── Render ─────────────────────────────────────────────────

    return (
        <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <span style={{ fontSize: '24px' }}>🔐</span>
                <div>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 600 }}>
                        Xác thực 2 yếu tố (2FA)
                    </h3>
                    <p style={{ margin: '4px 0 0', color: '#888', fontSize: '13px' }}>
                        {step === 'enabled' ? 'Đã bật — bảo vệ tài khoản admin' : 'Bảo vệ tài khoản với authenticator app'}
                    </p>
                </div>
                {step === 'enabled' && (
                    <span style={{
                        marginLeft: 'auto',
                        padding: '4px 12px',
                        background: 'rgba(34, 197, 94, 0.15)',
                        color: '#22c55e',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                    }}>
                        Đang bật
                    </span>
                )}
            </div>

            {error && (
                <p style={{
                    color: '#ef4444',
                    fontSize: '13px',
                    padding: '10px 14px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '8px',
                    margin: '0 0 16px',
                }}>
                    {error}
                </p>
            )}

            {/* Step: Idle — show enable button */}
            {step === 'idle' && (
                <button onClick={handleSetup} disabled={loading} style={btnPrimary}>
                    {loading ? 'Đang tạo...' : 'Bật 2FA'}
                </button>
            )}

            {/* Step: Scanning — show QR code */}
            {step === 'scanning' && (
                <div>
                    <p style={{ color: '#ccc', fontSize: '14px', margin: '0 0 16px' }}>
                        Quét mã QR bằng Google Authenticator hoặc Authy:
                    </p>
                    {qrCode && (
                        <div style={{
                            background: '#fff',
                            borderRadius: '12px',
                            padding: '16px',
                            display: 'inline-block',
                            marginBottom: '16px',
                        }}>
                            <img src={qrCode} alt="QR Code" width={200} height={200} />
                        </div>
                    )}
                    <details style={{ marginBottom: '20px' }}>
                        <summary style={{ color: '#888', fontSize: '13px', cursor: 'pointer' }}>
                            Nhập thủ công
                        </summary>
                        <code style={{
                            display: 'block',
                            margin: '8px 0',
                            padding: '10px',
                            background: '#111',
                            borderRadius: '8px',
                            color: '#3b82f6',
                            fontSize: '14px',
                            wordBreak: 'break-all',
                            fontFamily: 'monospace',
                        }}>
                            {manualKey}
                        </code>
                    </details>

                    <p style={{ color: '#ccc', fontSize: '14px', margin: '0 0 12px' }}>
                        Nhập mã 6 chữ số để xác nhận:
                    </p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={verifyCode}
                            onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={e => e.key === 'Enter' && handleVerify()}
                            style={inputStyle}
                            placeholder="000000"
                            autoFocus
                        />
                        <button
                            onClick={handleVerify}
                            disabled={loading || verifyCode.length !== 6}
                            style={{
                                ...btnPrimary,
                                opacity: verifyCode.length !== 6 ? 0.5 : 1,
                            }}
                        >
                            {loading ? '...' : 'Xác nhận'}
                        </button>
                    </div>
                </div>
            )}

            {/* Step: Recovery — show codes */}
            {step === 'recovery' && (
                <div>
                    <div style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '10px',
                        padding: '14px',
                        marginBottom: '16px',
                    }}>
                        <p style={{ color: '#f59e0b', fontSize: '13px', fontWeight: 600, margin: 0 }}>
                            ⚠️ Lưu recovery codes ở nơi an toàn!
                        </p>
                        <p style={{ color: '#d4a' + '574', fontSize: '12px', margin: '6px 0 0' }}>
                            Mỗi code chỉ dùng được 1 lần. Nếu mất Authenticator app, dùng code này để đăng nhập.
                        </p>
                    </div>

                    <div style={{
                        background: '#111',
                        borderRadius: '10px',
                        padding: '16px',
                        marginBottom: '16px',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                    }}>
                        {recoveryCodes.map((code, i) => (
                            <code key={i} style={{
                                color: '#fff',
                                fontSize: '14px',
                                fontFamily: 'monospace',
                                padding: '6px 8px',
                                background: '#1a1a1a',
                                borderRadius: '6px',
                                textAlign: 'center',
                            }}>
                                {code}
                            </code>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={copyRecoveryCodes} style={{
                            ...btnPrimary,
                            background: '#333',
                        }}>
                            📋 Copy tất cả
                        </button>
                        <button onClick={() => setStep('enabled')} style={btnPrimary}>
                            Đã lưu xong ✓
                        </button>
                    </div>
                </div>
            )}

            {/* Step: Enabled — show disable option */}
            {step === 'enabled' && (
                <details>
                    <summary style={{ color: '#888', fontSize: '13px', cursor: 'pointer' }}>
                        Tắt 2FA
                    </summary>
                    <div style={{ marginTop: '12px' }}>
                        <p style={{ color: '#ccc', fontSize: '13px', margin: '0 0 10px' }}>
                            Nhập mã hiện tại để tắt 2FA:
                        </p>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={disableCode}
                                onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))}
                                onKeyDown={e => e.key === 'Enter' && handleDisable()}
                                style={{ ...inputStyle, width: '160px' }}
                                placeholder="000000"
                            />
                            <button
                                onClick={handleDisable}
                                disabled={loading || disableCode.length !== 6}
                                style={{
                                    ...btnDanger,
                                    opacity: disableCode.length !== 6 ? 0.5 : 1,
                                }}
                            >
                                {loading ? '...' : 'Tắt 2FA'}
                            </button>
                        </div>
                    </div>
                </details>
            )}
        </div>
    );
}
