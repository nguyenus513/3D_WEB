'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from '@/components/ui/form';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { getProvinces, getDistricts, getWards, Province, District, Ward } from '@/lib/vietnam-provinces';

type StepType = 1 | 2 | 3 | 4 | 'otp' | 'success';

const step1Schema = z.object({
    email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
    password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
}).refine(data => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
});

const step2Schema = z.object({
    name: z.string().min(1, 'Vui lòng nhập họ và tên'),
    phone: z.string().min(1, 'Vui lòng nhập số điện thoại').regex(/^(0|\+84)[0-9]{9,10}$/, 'Số điện thoại không hợp lệ'),
    instagram: z.string().optional(),
});

const step3Schema = z.object({
    provinceCode: z.number().nullable(),
    provinceName: z.string(),
    districtCode: z.number().nullable(),
    districtName: z.string(),
    wardCode: z.number().nullable(),
    wardName: z.string(),
    addressLine: z.string(),
    recipientName: z.string(),
    recipientPhone: z.string(),
}).superRefine((data, ctx) => {
    const hasAnyAddress = !!(data.provinceCode || data.districtCode || data.wardCode || data.addressLine);

    if (hasAnyAddress) {
        if (!data.provinceCode) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng chọn Tỉnh/Thành phố', path: ['provinceCode'] });
        }
        if (!data.districtCode) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng chọn Quận/Huyện', path: ['districtCode'] });
        }
        if (!data.wardCode) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng chọn Phường/Xã', path: ['wardCode'] });
        }
        if (!data.addressLine) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng nhập địa chỉ chi tiết', path: ['addressLine'] });
        }

        const hasAnyRecipientInfo = !!(data.recipientName || data.recipientPhone);
        if (!hasAnyRecipientInfo) {
            if (!data.recipientName) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng nhập tên người nhận', path: ['recipientName'] });
            }
            if (!data.recipientPhone) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng nhập SĐT người nhận', path: ['recipientPhone'] });
            }
        }
    }
});

const step4Schema = z.object({
    agreeTerms: z.boolean().refine(v => v === true, { message: 'Vui lòng đồng ý với điều khoản dịch vụ' }),
});

const fullSchema = z.object({
    email: z.string().min(1).email(),
    password: z.string().min(6),
    confirmPassword: z.string(),
    name: z.string().min(1),
    phone: z.string().min(1),
    instagram: z.string().optional(),
    provinceCode: z.number().nullable(),
    provinceName: z.string(),
    districtCode: z.number().nullable(),
    districtName: z.string(),
    wardCode: z.number().nullable(),
    wardName: z.string(),
    addressLine: z.string(),
    recipientName: z.string(),
    recipientPhone: z.string(),
    agreeTerms: z.boolean(),
});

type FormValues = z.infer<typeof fullSchema>;

const steps = [
    { id: 1, title: 'Tài khoản', desc: 'Email & mật khẩu' },
    { id: 2, title: 'Thông tin', desc: 'Họ tên & liên hệ' },
    { id: 3, title: 'Địa chỉ', desc: 'Địa chỉ giao hàng' },
    { id: 4, title: 'Xác nhận', desc: 'Hoàn tất đăng ký' },
];

const inputClassName = "w-full px-4 py-3 bg-[var(--material-glass)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-cyan-500 outline-none";

export default function RegisterPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState<StepType>(1);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const form = useForm<FormValues>({
        defaultValues: {
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
        },
    });

    const formValues = form.watch();

    const [provinces, setProvinces] = useState<Province[]>([]);
    const [districts, setDistricts] = useState<District[]>([]);
    const [wards, setWards] = useState<Ward[]>([]);
    const [loadingAddress, setLoadingAddress] = useState(false);

    const [otpValue, setOtpValue] = useState('');
    const [otpError, setOtpError] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);

    useEffect(() => {
        getProvinces().then(setProvinces);
    }, []);

    useEffect(() => {
        if (formValues.provinceCode) {
            setLoadingAddress(true);
            getDistricts(formValues.provinceCode).then(data => {
                setDistricts(data);
                setLoadingAddress(false);
            });
            form.setValue('districtCode', null);
            form.setValue('districtName', '');
            form.setValue('wardCode', null);
            form.setValue('wardName', '');
            setWards([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formValues.provinceCode]);

    useEffect(() => {
        if (formValues.districtCode) {
            setLoadingAddress(true);
            getWards(formValues.districtCode).then(data => {
                setWards(data);
                setLoadingAddress(false);
            });
            form.setValue('wardCode', null);
            form.setValue('wardName', '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formValues.districtCode]);

    useEffect(() => {
        if (currentStep === 3 && !formValues.recipientName && !formValues.recipientPhone) {
            form.setValue('recipientName', formValues.name);
            form.setValue('recipientPhone', formValues.phone);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStep, formValues.name, formValues.phone, formValues.recipientName, formValues.recipientPhone]);

    const validateStep = async (step: number): Promise<boolean> => {
        setError('');
        const values = form.getValues();

        try {
            switch (step) {
                case 1:
                    step1Schema.parse({
                        email: values.email,
                        password: values.password,
                        confirmPassword: values.confirmPassword,
                    });
                    return true;

                case 2: {
                    const phoneClean = values.phone.replace(/\s/g, '');
                    step2Schema.parse({
                        name: values.name,
                        phone: phoneClean,
                        instagram: values.instagram,
                    });
                    return true;
                }

                case 3:
                    step3Schema.parse({
                        provinceCode: values.provinceCode,
                        provinceName: values.provinceName,
                        districtCode: values.districtCode,
                        districtName: values.districtName,
                        wardCode: values.wardCode,
                        wardName: values.wardName,
                        addressLine: values.addressLine,
                        recipientName: values.recipientName,
                        recipientPhone: values.recipientPhone,
                    });
                    return true;

                case 4:
                    step4Schema.parse({ agreeTerms: values.agreeTerms });
                    return true;

                default:
                    return true;
            }
        } catch (err) {
            if (err instanceof z.ZodError) {
                setError(err.issues[0].message);
            }
            return false;
        }
    };

    const nextStep = async () => {
        if (typeof currentStep === 'number' && await validateStep(currentStep)) {
            if (currentStep < 4) {
                const values = form.getValues();
                if (currentStep === 1 && !values.name && values.email) {
                    const extractedName = values.email.split('@')[0]
                        .replace(/[._]/g, ' ')
                        .replace(/\d+/g, '')
                        .trim()
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');

                    form.setValue('name', extractedName || 'Khách hàng');
                    form.setValue('recipientName', values.recipientName || extractedName || 'Khách hàng');
                    form.setValue('recipientPhone', values.recipientPhone || values.phone);
                }
                if (currentStep === 2 && !values.recipientName) {
                    form.setValue('recipientName', values.name);
                    form.setValue('recipientPhone', values.phone);
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

    const handleSubmit = async () => {
        if (!await validateStep(4)) return;

        setLoading(true);
        setError('');
        const values = form.getValues();

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: values.name,
                    email: values.email,
                    phone: values.phone,
                    instagram: values.instagram,
                    password: values.password,
                    shipping_address: values.provinceCode ? {
                        full_name: values.recipientName,
                        phone: values.recipientPhone,
                        address_line: values.addressLine,
                        ward: values.wardName,
                        district: values.districtName,
                        province: values.provinceName,
                    } : undefined,
                }),
            });

            const result = await res.json();

            if (!res.ok) {
                const errorObj = result.error;
                const errorMessage = typeof errorObj === 'object' && errorObj !== null
                    ? (errorObj.message || JSON.stringify(errorObj))
                    : (errorObj || 'Đã có lỗi xảy ra');
                setError(errorMessage);
                return;
            }

            const responseData = result.data || result;
            if (responseData.requiresVerification) {
                setCurrentStep('otp');
            }
        } catch {
            setError('Đã có lỗi xảy ra. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = useCallback(async (code?: string) => {
        const otpCode = code ?? otpValue;
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
                body: JSON.stringify({ email: form.getValues().email, otp: otpCode }),
            });

            const result = await res.json();
            if (!res.ok) {
                const errorObj = result.error;
                setOtpError(
                    typeof errorObj === 'object' && errorObj?.message
                        ? errorObj.message
                        : (errorObj || 'Mã xác thực không đúng')
                );
                return;
            }

            setCurrentStep('success');
        } catch {
            setOtpError('Đã có lỗi xảy ra');
        } finally {
            setVerifying(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [otpValue]);

    const handleResendOtp = async () => {
        setResending(true);
        const values = form.getValues();
        try {
            await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: values.name,
                    email: values.email,
                    password: values.password,
                }),
            });
            setOtpValue('');
        } catch {
            setOtpError('Không thể gửi lại mã');
        } finally {
            setResending(false);
        }
    };

    const handleOtpChange = (value: string) => {
        setOtpValue(value);
        setOtpError('');
        if (value.length === 6) {
            handleVerifyOtp(value);
        }
    };

    if (currentStep === 'success') {
        return (
            <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center px-6 py-20">
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
                    <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-4">Đăng Ký Thành Công!</h1>
                    <p className="text-[var(--text-secondary)] mb-8">Tài khoản đã được kích hoạt. Bây giờ bạn có thể đăng nhập.</p>
                    <Button onClick={() => router.push('/login')} className="w-full">
                        Đăng nhập ngay
                    </Button>
                </motion.div>
            </div>
        );
    }

    if (currentStep === 'otp') {
        return (
            <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center px-6 py-20">
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
                        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Xác Thực Email</h1>
                        <p className="text-[var(--text-secondary)]">Nhập mã 6 số đã gửi đến <span className="text-[var(--text-primary)]">{formValues.email}</span></p>
                    </div>

                    <div className="flex justify-center mb-6">
                        <InputOTP maxLength={6} value={otpValue} onChange={handleOtpChange}>
                            <InputOTPGroup>
                                <InputOTPSlot index={0} className="bg-[var(--material-glass)] border-[var(--border-color)] text-[var(--text-primary)]" />
                                <InputOTPSlot index={1} className="bg-[var(--material-glass)] border-[var(--border-color)] text-[var(--text-primary)]" />
                                <InputOTPSlot index={2} className="bg-[var(--material-glass)] border-[var(--border-color)] text-[var(--text-primary)]" />
                                <InputOTPSlot index={3} className="bg-[var(--material-glass)] border-[var(--border-color)] text-[var(--text-primary)]" />
                                <InputOTPSlot index={4} className="bg-[var(--material-glass)] border-[var(--border-color)] text-[var(--text-primary)]" />
                                <InputOTPSlot index={5} className="bg-[var(--material-glass)] border-[var(--border-color)] text-[var(--text-primary)]" />
                            </InputOTPGroup>
                        </InputOTP>
                    </div>

                    {otpError && <p className="text-red-400 text-center text-sm mb-4">{otpError}</p>}

                    <Button
                        onClick={() => handleVerifyOtp()}
                        disabled={verifying || otpValue.length !== 6}
                        className="w-full mb-4"
                    >
                        {verifying ? 'Đang xác thực...' : 'Xác thực'}
                    </Button>

                    <button
                        onClick={handleResendOtp}
                        disabled={resending}
                        className="w-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm"
                    >
                        {resending ? 'Đang gửi...' : 'Gửi lại mã'}
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center px-6 py-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg"
            >
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Đăng Ký</h1>
                    <p className="text-[var(--text-secondary)]">Tạo tài khoản để đặt hàng</p>
                </div>

                <button
                    onClick={() => signIn('google', { callbackUrl: '/api/auth/google-callback' })}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-[var(--material-glass)] hover:opacity-80 border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-medium transition-all"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Đăng ký bằng Google
                </button>

                <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-[var(--material-glass)]" />
                    <span className="text-[var(--text-tertiary)] text-sm">hoặc đăng ký bằng email</span>
                    <div className="flex-1 h-px bg-[var(--material-glass)]" />
                </div>

                <div className="flex justify-between mb-8">
                    {steps.map((step, idx) => (
                        <div key={step.id} className="flex-1 relative">
                            <div className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${typeof currentStep === 'number' && currentStep > step.id
                                    ? 'bg-emerald-500 text-[var(--text-primary)]'
                                    : currentStep === step.id
                                        ? 'bg-cyan-500 text-[var(--text-primary)]'
                                        : 'bg-[var(--material-glass)] text-[var(--text-tertiary)]'
                                    }`}>
                                    {typeof currentStep === 'number' && currentStep > step.id ? '✓' : step.id}
                                </div>
                                <span className={`mt-2 text-xs ${currentStep === step.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                                    {step.title}
                                </span>
                            </div>
                            {idx < steps.length - 1 && (
                                <div className={`absolute top-5 left-1/2 w-full h-0.5 -z-10 ${typeof currentStep === 'number' && currentStep > step.id ? 'bg-emerald-500' : 'bg-[var(--material-glass)]'
                                    }`} />
                            )}
                        </div>
                    ))}
                </div>

                <div className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6">
                    <Form {...form}>
                        <AnimatePresence mode="wait">
                            {currentStep === 1 && (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <input
                                                        type="email"
                                                        {...field}
                                                        className={inputClassName}
                                                        placeholder="your@email.com"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Mật khẩu</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <input
                                                            type={showPassword ? 'text' : 'password'}
                                                            {...field}
                                                            className={`${inputClassName} pr-12`}
                                                            placeholder="Tối thiểu 6 ký tự"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                                                        >
                                                            {showPassword ? '🙈' : '👁️'}
                                                        </button>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="confirmPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Xác nhận mật khẩu</FormLabel>
                                                <FormControl>
                                                    <input
                                                        type="password"
                                                        {...field}
                                                        className={inputClassName}
                                                        placeholder="Nhập lại mật khẩu"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </motion.div>
                            )}

                            {currentStep === 2 && (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Họ và tên</FormLabel>
                                                <FormControl>
                                                    <input
                                                        type="text"
                                                        {...field}
                                                        className={inputClassName}
                                                        placeholder="Nguyễn Văn A"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Số điện thoại</FormLabel>
                                                <FormControl>
                                                    <input
                                                        type="tel"
                                                        {...field}
                                                        className={inputClassName}
                                                        placeholder="0901234567"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="instagram"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Instagram (tuỳ chọn)</FormLabel>
                                                <FormControl>
                                                    <input
                                                        type="text"
                                                        {...field}
                                                        className={inputClassName}
                                                        placeholder="@username"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </motion.div>
                            )}

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
                                            <label className="block text-[var(--text-secondary)] text-sm mb-2">Tỉnh/Thành phố</label>
                                            <select
                                                value={formValues.provinceCode || ''}
                                                onChange={e => {
                                                    const code = Number(e.target.value);
                                                    const province = provinces.find(p => p.code === code);
                                                    form.setValue('provinceCode', code || null);
                                                    form.setValue('provinceName', province?.name || '');
                                                }}
                                                className="w-full px-4 py-3 bg-[var(--material-glass)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:border-cyan-500 outline-none appearance-none cursor-pointer"
                                            >
                                                <option value="" className="bg-[var(--material-panel)]">Chọn Tỉnh/Thành phố</option>
                                                {provinces.map(p => (
                                                    <option key={p.code} value={p.code} className="bg-[var(--material-panel)]">{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[var(--text-secondary)] text-sm mb-2">Quận/Huyện</label>
                                            <select
                                                value={formValues.districtCode || ''}
                                                onChange={e => {
                                                    const code = Number(e.target.value);
                                                    const district = districts.find(d => d.code === code);
                                                    form.setValue('districtCode', code || null);
                                                    form.setValue('districtName', district?.name || '');
                                                }}
                                                disabled={!formValues.provinceCode || loadingAddress}
                                                className="w-full px-4 py-3 bg-[var(--material-glass)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:border-cyan-500 outline-none appearance-none cursor-pointer disabled:opacity-50"
                                            >
                                                <option value="" className="bg-[var(--material-panel)]">
                                                    {loadingAddress ? 'Đang tải...' : 'Chọn Quận/Huyện'}
                                                </option>
                                                {districts.map(d => (
                                                    <option key={d.code} value={d.code} className="bg-[var(--material-panel)]">{d.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[var(--text-secondary)] text-sm mb-2">Phường/Xã</label>
                                            <select
                                                value={formValues.wardCode || ''}
                                                onChange={e => {
                                                    const code = Number(e.target.value);
                                                    const ward = wards.find(w => w.code === code);
                                                    form.setValue('wardCode', code || null);
                                                    form.setValue('wardName', ward?.name || '');
                                                }}
                                                disabled={!formValues.districtCode || loadingAddress}
                                                className="w-full px-4 py-3 bg-[var(--material-glass)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:border-cyan-500 outline-none appearance-none cursor-pointer disabled:opacity-50"
                                            >
                                                <option value="" className="bg-[var(--material-panel)]">
                                                    {loadingAddress ? 'Đang tải...' : 'Chọn Phường/Xã'}
                                                </option>
                                                {wards.map(w => (
                                                    <option key={w.code} value={w.code} className="bg-[var(--material-panel)]">{w.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <FormField
                                                control={form.control}
                                                name="addressLine"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Địa chỉ chi tiết</FormLabel>
                                                        <FormControl>
                                                            <input
                                                                type="text"
                                                                {...field}
                                                                className={inputClassName}
                                                                placeholder="Số nhà, đường, ngõ..."
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="border-t border-[var(--border-color)] pt-4 mt-4">
                                        <p className="text-[var(--text-tertiary)] text-xs mb-3">Thông tin người nhận</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="recipientName"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Tên người nhận</FormLabel>
                                                        <FormControl>
                                                            <input
                                                                type="text"
                                                                {...field}
                                                                className={inputClassName}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="recipientPhone"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>SĐT người nhận</FormLabel>
                                                        <FormControl>
                                                            <input
                                                                type="tel"
                                                                {...field}
                                                                className={inputClassName}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {currentStep === 4 && (
                                <motion.div
                                    key="step4"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    <div className="space-y-3">
                                        <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                                            <span className="text-[var(--text-secondary)]">Email</span>
                                            <span className="text-[var(--text-primary)]">{formValues.email}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                                            <span className="text-[var(--text-secondary)]">Họ tên</span>
                                            <span className="text-[var(--text-primary)]">{formValues.name}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                                            <span className="text-[var(--text-secondary)]">SĐT</span>
                                            <span className="text-[var(--text-primary)]">{formValues.phone}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                                            <span className="text-[var(--text-secondary)]">Người nhận</span>
                                            <span className="text-[var(--text-primary)]">{formValues.recipientName} - {formValues.recipientPhone}</span>
                                        </div>
                                        <div className="py-2">
                                            <span className="text-[var(--text-secondary)] block mb-1">Địa chỉ giao hàng</span>
                                            <span className="text-[var(--text-primary)] text-sm">
                                                {formValues.addressLine}, {formValues.wardName}, {formValues.districtName}, {formValues.provinceName}
                                            </span>
                                        </div>
                                    </div>

                                    <label className="flex items-start gap-3 cursor-pointer mt-6">
                                        <input
                                            type="checkbox"
                                            checked={formValues.agreeTerms}
                                            onChange={e => form.setValue('agreeTerms', e.target.checked)}
                                            className="w-5 h-5 rounded bg-[var(--material-glass)] border border-[var(--border-color)] checked:bg-cyan-500 checked:border-cyan-500 mt-0.5"
                                        />
                                        <span className="text-[var(--text-secondary)] text-sm">
                                            Tôi đồng ý với <Link href="/terms" className="text-cyan-400 hover:underline">Điều khoản dịch vụ</Link> và <Link href="/privacy" className="text-cyan-400 hover:underline">Chính sách bảo mật</Link>
                                        </span>
                                    </label>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {error && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-red-400 text-sm mt-4"
                            >
                                {error}
                            </motion.p>
                        )}

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
                    </Form>
                </div>

                <p className="text-center text-[var(--text-secondary)] mt-6">
                    Đã có tài khoản?{' '}
                    <Link href="/login" className="text-cyan-400 hover:underline">Đăng nhập</Link>
                </p>
            </motion.div>
        </div>
    );
}
