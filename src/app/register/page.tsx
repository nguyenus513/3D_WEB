'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { getProvinces, getDistricts, getWards, Province, District, Ward } from '@/lib/vietnam-provinces';

type StepType = 1 | 2 | 3 | 4 | 'otp' | 'success';

interface FormData {
    // Step 1: Account
    email: string;
    password: string;
    confirmPassword: string;
    // Step 2: Personal
    name: string;
    phone: string;
    instagram: string;
    // Step 3: Address
    provinceCode: number | null;
    provinceName: string;
    districtCode: number | null;
    districtName: string;
    wardCode: number | null;
    wardName: string;
    addressLine: string;
    recipientName: string;
    recipientPhone: string;
    // Step 4: Confirm
    agreeTerms: boolean;
}

const steps = [
    { id: 1, title: 'Tài khoản', desc: 'Email & mật khẩu' },
    { id: 2, title: 'Thông tin', desc: 'Họ tên & liên hệ' },
    { id: 3, title: 'Địa chỉ', desc: 'Địa chỉ giao hàng' },
    { id: 4, title: 'Xác nhận', desc: 'Hoàn tất đăng ký' },
];

export default function RegisterPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState<StepType>(1);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const [formData, setFormData] = useState<FormData>({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        phone: '',
        instagram: '',
        provinceCode: null,
        provinceName: '',
        districtCode: null,
        districtName: '',
        wardCode: null,
        wardName: '',
        addressLine: '',
        recipientName: '',
        recipientPhone: '',
        agreeTerms: false,
    });

    // Vietnam address data
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [districts, setDistricts] = useState<District[]>([]);
    const [wards, setWards] = useState<Ward[]>([]);
    const [loadingAddress, setLoadingAddress] = useState(false);

    // OTP state
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [otpError, setOtpError] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Load provinces on mount
    useEffect(() => {
        getProvinces().then(setProvinces);
    }, []);

    // Load districts when province changes
    useEffect(() => {
        if (formData.provinceCode) {
            setLoadingAddress(true);
            getDistricts(formData.provinceCode).then(data => {
                setDistricts(data);
                setLoadingAddress(false);
            });
            // Reset district and ward
            setFormData(prev => ({
                ...prev,
                districtCode: null,
                districtName: '',
                wardCode: null,
                wardName: '',
            }));
            setWards([]);
        }
    }, [formData.provinceCode]);

    // Load wards when district changes
    useEffect(() => {
        if (formData.districtCode) {
            setLoadingAddress(true);
            getWards(formData.districtCode).then(data => {
                setWards(data);
                setLoadingAddress(false);
            });
            setFormData(prev => ({
                ...prev,
                wardCode: null,
                wardName: '',
            }));
        }
    }, [formData.districtCode]);

    // Auto-fill recipient info from personal info
    useEffect(() => {
        if (currentStep === 3 && !formData.recipientName && !formData.recipientPhone) {
            setFormData(prev => ({
                ...prev,
                recipientName: prev.name,
                recipientPhone: prev.phone,
            }));
        }
    }, [currentStep, formData.name, formData.phone, formData.recipientName, formData.recipientPhone]);

    const validateStep = (step: number): boolean => {
        setError('');

        switch (step) {
            case 1:
                if (!formData.email) {
                    setError('Vui lòng nhập email');
                    return false;
                }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
                    setError('Email không hợp lệ');
                    return false;
                }
                if (!formData.password || formData.password.length < 6) {
                    setError('Mật khẩu phải có ít nhất 6 ký tự');
                    return false;
                }
                if (formData.password !== formData.confirmPassword) {
                    setError('Mật khẩu xác nhận không khớp');
                    return false;
                }
                return true;

            case 2:
                if (!formData.name) {
                    setError('Vui lòng nhập họ và tên');
                    return false;
                }
                if (!formData.phone) {
                    setError('Vui lòng nhập số điện thoại');
                    return false;
                }
                if (!/^(0|\+84)[0-9]{9,10}$/.test(formData.phone.replace(/\s/g, ''))) {
                    setError('Số điện thoại không hợp lệ');
                    return false;
                }
                return true;

            case 3:
                const hasAnyAddress = !!(formData.provinceCode || formData.districtCode || formData.wardCode || formData.addressLine);

                // Only validate address fields if user started filling them
                if (hasAnyAddress) {
                    if (!formData.provinceCode) {
                        setError('Vui lòng chọn Tỉnh/Thành phố');
                        return false;
                    }
                    if (!formData.districtCode) {
                        setError('Vui lòng chọn Quận/Huyện');
                        return false;
                    }
                    if (!formData.wardCode) {
                        setError('Vui lòng chọn Phường/Xã');
                        return false;
                    }
                    if (!formData.addressLine) {
                        setError('Vui lòng nhập địa chỉ chi tiết');
                        return false;
                    }
                }

                // If user doesn't provide recipient info but has address, require it
                const hasAnyRecipientInfo = !!(formData.recipientName || formData.recipientPhone);
                if (hasAnyAddress && !hasAnyRecipientInfo) {
                    if (!formData.recipientName) {
                        setError('Vui lòng nhập tên người nhận');
                        return false;
                    }
                    if (!formData.recipientPhone) {
                        setError('Vui lòng nhập SĐT người nhận');
                        return false;
                    }
                }

                return true;

            case 4:
                if (!formData.agreeTerms) {
                    setError('Vui lòng đồng ý với điều khoản dịch vụ');
                    return false;
                }
                return true;

            default:
                return true;
        }
    };

    const nextStep = () => {
        if (typeof currentStep === 'number' && validateStep(currentStep)) {
            if (currentStep < 4) {
                // Auto-fill name from email when moving to step 2
                if (currentStep === 1 && !formData.name && formData.email) {
                    const extractedName = formData.email.split('@')[0]
                        .replace(/[._]/g, ' ')  // Replace dots/underscores with spaces
                        .replace(/\d+/g, '')    // Remove numbers
                        .trim()
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');

                    setFormData(prev => ({
                        ...prev,
                        name: extractedName || 'Khách hàng',
                        recipientName: prev.recipientName || extractedName || 'Khách hàng',
                        recipientPhone: prev.recipientPhone || prev.phone,
                    }));
                }
                // Auto-fill recipient info from profile when moving to step 3
                if (currentStep === 2 && !formData.recipientName) {
                    setFormData(prev => ({
                        ...prev,
                        recipientName: prev.name,
                        recipientPhone: prev.phone,
                    }));
                }
                setCurrentStep((currentStep + 1) as StepType);
            }
        }
    };

    const prevStep = () => {
        if (typeof currentStep === 'number' && currentStep > 1) {
            setCurrentStep((currentStep - 1) as StepType);
            setError('');
        }
    };

    // Submit registration
    const handleSubmit = async () => {
        if (!validateStep(4)) return;

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    instagram: formData.instagram,
                    password: formData.password,
                    shipping_address: formData.provinceCode ? {
                        full_name: formData.recipientName,
                        phone: formData.recipientPhone,
                        address_line: formData.addressLine,
                        ward: formData.wardName,
                        district: formData.districtName,
                        province: formData.provinceName,
                    } : undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                const errorMessage = typeof data.error === 'object' && data.error !== null
                    ? JSON.stringify(data.error)
                    : (data.error || 'Đã có lỗi xảy ra');
                setError(errorMessage);
                return;
            }

            if (data.requiresVerification) {
                setCurrentStep('otp');
            }
        } catch {
            setError('Đã có lỗi xảy ra. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    // OTP handlers
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);
        setOtpError('');
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOtp = async () => {
        const otpCode = otp.join('');
        if (otpCode.length !== 6) {
            setOtpError('Vui lòng nhập đủ 6 số');
            return;
        }

        setVerifying(true);
        setOtpError('');

        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email, otp: otpCode }),
            });

            const data = await res.json();
            if (!res.ok) {
                setOtpError(data.error || 'Mã xác thực không đúng');
                return;
            }

            setCurrentStep('success');
        } catch {
            setOtpError('Đã có lỗi xảy ra');
        } finally {
            setVerifying(false);
        }
    };

    const handleResendOtp = async () => {
        setResending(true);
        try {
            await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                }),
            });
            setOtp(['', '', '', '', '', '']);
            otpRefs.current[0]?.focus();
        } catch {
            setOtpError('Không thể gửi lại mã');
        } finally {
            setResending(false);
        }
    };

    useEffect(() => {
        if (otp.every(d => d) && otp.join('').length === 6) {
            handleVerifyOtp();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [otp]);

    // Success screen
    if (currentStep === 'success') {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6 py-20">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md text-center"
                >
                    <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-4">Đăng Ký Thành Công!</h1>
                    <p className="text-white/60 mb-8">Tài khoản đã được kích hoạt. Bây giờ bạn có thể đăng nhập.</p>
                    <Button onClick={() => router.push('/login')} className="w-full">
                        Đăng nhập ngay
                    </Button>
                </motion.div>
            </div>
        );
    }

    // OTP screen
    if (currentStep === 'otp') {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6 py-20">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md"
                >
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Xác Thực Email</h1>
                        <p className="text-white/60">Nhập mã 6 số đã gửi đến <span className="text-white">{formData.email}</span></p>
                    </div>

                    <div className="flex justify-center gap-3 mb-6">
                        {otp.map((digit, idx) => (
                            <input
                                key={idx}
                                ref={el => { otpRefs.current[idx] = el; }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={e => handleOtpChange(idx, e.target.value)}
                                onKeyDown={e => handleOtpKeyDown(idx, e)}
                                className="w-12 h-14 text-center text-2xl font-bold bg-white/5 border border-white/20 rounded-xl text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                            />
                        ))}
                    </div>

                    {otpError && <p className="text-red-400 text-center text-sm mb-4">{otpError}</p>}

                    <Button
                        onClick={handleVerifyOtp}
                        disabled={verifying || otp.join('').length !== 6}
                        className="w-full mb-4"
                    >
                        {verifying ? 'Đang xác thực...' : 'Xác thực'}
                    </Button>

                    <button
                        onClick={handleResendOtp}
                        disabled={resending}
                        className="w-full text-white/60 hover:text-white text-sm"
                    >
                        {resending ? 'Đang gửi...' : 'Gửi lại mã'}
                    </button>
                </motion.div>
            </div>
        );
    }

    // Main form
    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6 py-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Đăng Ký</h1>
                    <p className="text-white/60">Tạo tài khoản để đặt hàng</p>
                </div>

                {/* Google Sign Up */}
                <button
                    onClick={() => signIn('google', { callbackUrl: '/api/auth/google-callback' })}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-all"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Đăng ký bằng Google
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-white/40 text-sm">hoặc đăng ký bằng email</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Progress */}
                <div className="flex justify-between mb-8">
                    {steps.map((step, idx) => (
                        <div key={step.id} className="flex-1 relative">
                            <div className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${typeof currentStep === 'number' && currentStep > step.id
                                    ? 'bg-emerald-500 text-white'
                                    : currentStep === step.id
                                        ? 'bg-cyan-500 text-white'
                                        : 'bg-white/10 text-white/40'
                                    }`}>
                                    {typeof currentStep === 'number' && currentStep > step.id ? '✓' : step.id}
                                </div>
                                <span className={`mt-2 text-xs ${currentStep === step.id ? 'text-white' : 'text-white/40'}`}>
                                    {step.title}
                                </span>
                            </div>
                            {idx < steps.length - 1 && (
                                <div className={`absolute top-5 left-1/2 w-full h-0.5 -z-10 ${typeof currentStep === 'number' && currentStep > step.id ? 'bg-emerald-500' : 'bg-white/10'
                                    }`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Form */}
                <div className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6">
                    <AnimatePresence mode="wait">
                        {/* Step 1: Account */}
                        {currentStep === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="block text-white/60 text-sm mb-2">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-cyan-500 outline-none"
                                        placeholder="your@email.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-white/60 text-sm mb-2">Mật khẩu</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-cyan-500 outline-none pr-12"
                                            placeholder="Tối thiểu 6 ký tự"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                                        >
                                            {showPassword ? '🙈' : '👁️'}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-white/60 text-sm mb-2">Xác nhận mật khẩu</label>
                                    <input
                                        type="password"
                                        value={formData.confirmPassword}
                                        onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-cyan-500 outline-none"
                                        placeholder="Nhập lại mật khẩu"
                                    />
                                </div>
                            </motion.div>
                        )}

                        {/* Step 2: Personal */}
                        {currentStep === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="block text-white/60 text-sm mb-2">Họ và tên</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-cyan-500 outline-none"
                                        placeholder="Nguyễn Văn A"
                                    />
                                </div>
                                <div>
                                    <label className="block text-white/60 text-sm mb-2">Số điện thoại</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-cyan-500 outline-none"
                                        placeholder="0901234567"
                                    />
                                </div>
                                <div>
                                    <label className="block text-white/60 text-sm mb-2">Instagram (tuỳ chọn)</label>
                                    <input
                                        type="text"
                                        value={formData.instagram}
                                        onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-cyan-500 outline-none"
                                        placeholder="@username"
                                    />
                                </div>
                            </motion.div>
                        )}

                        {/* Step 3: Address */}
                        {currentStep === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-white/60 text-sm mb-2">Tỉnh/Thành phố</label>
                                        <select
                                            value={formData.provinceCode || ''}
                                            onChange={e => {
                                                const code = Number(e.target.value);
                                                const province = provinces.find(p => p.code === code);
                                                setFormData({
                                                    ...formData,
                                                    provinceCode: code,
                                                    provinceName: province?.name || '',
                                                });
                                            }}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-cyan-500 outline-none appearance-none cursor-pointer"
                                        >
                                            <option value="" className="bg-[#1D1D1F]">Chọn Tỉnh/Thành phố</option>
                                            {provinces.map(p => (
                                                <option key={p.code} value={p.code} className="bg-[#1D1D1F]">{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-white/60 text-sm mb-2">Quận/Huyện</label>
                                        <select
                                            value={formData.districtCode || ''}
                                            onChange={e => {
                                                const code = Number(e.target.value);
                                                const district = districts.find(d => d.code === code);
                                                setFormData({
                                                    ...formData,
                                                    districtCode: code,
                                                    districtName: district?.name || '',
                                                });
                                            }}
                                            disabled={!formData.provinceCode || loadingAddress}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-cyan-500 outline-none appearance-none cursor-pointer disabled:opacity-50"
                                        >
                                            <option value="" className="bg-[#1D1D1F]">
                                                {loadingAddress ? 'Đang tải...' : 'Chọn Quận/Huyện'}
                                            </option>
                                            {districts.map(d => (
                                                <option key={d.code} value={d.code} className="bg-[#1D1D1F]">{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-white/60 text-sm mb-2">Phường/Xã</label>
                                        <select
                                            value={formData.wardCode || ''}
                                            onChange={e => {
                                                const code = Number(e.target.value);
                                                const ward = wards.find(w => w.code === code);
                                                setFormData({
                                                    ...formData,
                                                    wardCode: code,
                                                    wardName: ward?.name || '',
                                                });
                                            }}
                                            disabled={!formData.districtCode || loadingAddress}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-cyan-500 outline-none appearance-none cursor-pointer disabled:opacity-50"
                                        >
                                            <option value="" className="bg-[#1D1D1F]">
                                                {loadingAddress ? 'Đang tải...' : 'Chọn Phường/Xã'}
                                            </option>
                                            {wards.map(w => (
                                                <option key={w.code} value={w.code} className="bg-[#1D1D1F]">{w.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-white/60 text-sm mb-2">Địa chỉ chi tiết</label>
                                        <input
                                            type="text"
                                            value={formData.addressLine}
                                            onChange={e => setFormData({ ...formData, addressLine: e.target.value })}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-cyan-500 outline-none"
                                            placeholder="Số nhà, đường, ngõ..."
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-white/10 pt-4 mt-4">
                                    <p className="text-white/40 text-xs mb-3">Thông tin người nhận</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-white/60 text-sm mb-2">Tên người nhận</label>
                                            <input
                                                type="text"
                                                value={formData.recipientName}
                                                onChange={e => setFormData({ ...formData, recipientName: e.target.value })}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-cyan-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-white/60 text-sm mb-2">SĐT người nhận</label>
                                            <input
                                                type="tel"
                                                value={formData.recipientPhone}
                                                onChange={e => setFormData({ ...formData, recipientPhone: e.target.value })}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-cyan-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 4: Confirm */}
                        {currentStep === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                <div className="space-y-3">
                                    <div className="flex justify-between py-2 border-b border-white/10">
                                        <span className="text-white/60">Email</span>
                                        <span className="text-white">{formData.email}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/10">
                                        <span className="text-white/60">Họ tên</span>
                                        <span className="text-white">{formData.name}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/10">
                                        <span className="text-white/60">SĐT</span>
                                        <span className="text-white">{formData.phone}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/10">
                                        <span className="text-white/60">Người nhận</span>
                                        <span className="text-white">{formData.recipientName} - {formData.recipientPhone}</span>
                                    </div>
                                    <div className="py-2">
                                        <span className="text-white/60 block mb-1">Địa chỉ giao hàng</span>
                                        <span className="text-white text-sm">
                                            {formData.addressLine}, {formData.wardName}, {formData.districtName}, {formData.provinceName}
                                        </span>
                                    </div>
                                </div>

                                <label className="flex items-start gap-3 cursor-pointer mt-6">
                                    <input
                                        type="checkbox"
                                        checked={formData.agreeTerms}
                                        onChange={e => setFormData({ ...formData, agreeTerms: e.target.checked })}
                                        className="w-5 h-5 rounded bg-white/5 border border-white/20 checked:bg-cyan-500 checked:border-cyan-500 mt-0.5"
                                    />
                                    <span className="text-white/60 text-sm">
                                        Tôi đồng ý với <Link href="/terms" className="text-cyan-400 hover:underline">Điều khoản dịch vụ</Link> và <Link href="/privacy" className="text-cyan-400 hover:underline">Chính sách bảo mật</Link>
                                    </span>
                                </label>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Error */}
                    {error && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-red-400 text-sm mt-4"
                        >
                            {error}
                        </motion.p>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3 mt-6">
                        {typeof currentStep === 'number' && currentStep > 1 && (
                            <Button variant="secondary" onClick={prevStep} className="flex-1">
                                Quay lại
                            </Button>
                        )}
                        {typeof currentStep === 'number' && currentStep < 4 && (
                            <Button onClick={nextStep} className="flex-1">
                                Tiếp tục
                            </Button>
                        )}
                        {currentStep === 4 && (
                            <Button onClick={handleSubmit} disabled={loading} className="flex-1">
                                {loading ? 'Đang xử lý...' : 'Đăng ký'}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Login link */}
                <p className="text-center text-white/60 mt-6">
                    Đã có tài khoản?{' '}
                    <Link href="/login" className="text-cyan-400 hover:underline">Đăng nhập</Link>
                </p>
            </motion.div>
        </div>
    );
}
