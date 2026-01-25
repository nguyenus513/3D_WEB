'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { getProvinces, getDistricts, getWards, Province, District, Ward } from '@/lib/vietnam-provinces';

interface FormData {
    // Personal
    name: string;
    phone: string;
    // Address
    provinceCode: number | null;
    provinceName: string;
    districtCode: number | null;
    districtName: string;
    wardCode: number | null;
    wardName: string;
    addressLine: string;
    recipientName: string;
    recipientPhone: string;
}

export default function CompleteProfilePage() {
    const { data: session, status, update } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentStep, setCurrentStep] = useState<1 | 2>(1);

    const [formData, setFormData] = useState<FormData>({
        name: '',
        phone: '',
        provinceCode: null,
        provinceName: '',
        districtCode: null,
        districtName: '',
        wardCode: null,
        wardName: '',
        addressLine: '',
        recipientName: '',
        recipientPhone: '',
    });

    // Vietnam address data
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [districts, setDistricts] = useState<District[]>([]);
    const [wards, setWards] = useState<Ward[]>([]);
    const [loadingAddress, setLoadingAddress] = useState(false);

    // Pre-fill name from Google profile
    useEffect(() => {
        if (session?.user?.name) {
            setFormData(prev => ({
                ...prev,
                name: session.user?.name || '',
                recipientName: session.user?.name || '',
            }));
        }
    }, [session]);

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

    // Auto-fill recipient info
    useEffect(() => {
        if (currentStep === 2 && !formData.recipientName && !formData.recipientPhone) {
            setFormData(prev => ({
                ...prev,
                recipientName: prev.name,
                recipientPhone: prev.phone,
            }));
        }
    }, [currentStep, formData.name, formData.phone, formData.recipientName, formData.recipientPhone]);

    // Redirect if not authenticated
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    const validateStep = (step: number): boolean => {
        setError('');
        if (step === 1) {
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
        }
        if (step === 2) {
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
            if (!formData.recipientName) {
                setError('Vui lòng nhập tên người nhận');
                return false;
            }
            if (!formData.recipientPhone) {
                setError('Vui lòng nhập SĐT người nhận');
                return false;
            }
            return true;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validateStep(2)) return;

        setLoading(true);
        setError('');

        try {
            // Update profile
            const profileRes = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    phone: formData.phone,
                }),
            });

            if (!profileRes.ok) {
                const data = await profileRes.json();
                throw new Error(data.error || 'Không thể cập nhật hồ sơ');
            }

            // Create address
            const addressRes = await fetch('/api/addresses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: 'Nhà riêng',
                    full_name: formData.recipientName,
                    phone: formData.recipientPhone,
                    address_line: formData.addressLine,
                    ward: formData.wardName,
                    district: formData.districtName,
                    province: formData.provinceName,
                    is_default: true,
                }),
            });

            if (!addressRes.ok) {
                console.error('Address creation failed');
            }

            // Update session to clear isNewUser flag
            await update();

            // Redirect to account
            router.push('/account');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Đã có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6 py-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-lg"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white mb-6">
                        <svg className="w-8 h-8 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Hoàn Tất Hồ Sơ</h1>
                    <p className="text-white/60">Vui lòng điền thông tin để tiếp tục</p>
                </div>

                {/* Progress */}
                <div className="flex justify-center gap-4 mb-8">
                    <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${currentStep >= 1 ? 'bg-cyan-500 text-white' : 'bg-white/10 text-white/40'}`}>
                            {currentStep > 1 ? '✓' : '1'}
                        </div>
                        <span className={`text-sm ${currentStep === 1 ? 'text-white' : 'text-white/40'}`}>Thông tin</span>
                    </div>
                    <div className={`w-12 h-0.5 my-5 ${currentStep > 1 ? 'bg-cyan-500' : 'bg-white/10'}`} />
                    <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${currentStep === 2 ? 'bg-cyan-500 text-white' : 'bg-white/10 text-white/40'}`}>
                            2
                        </div>
                        <span className={`text-sm ${currentStep === 2 ? 'text-white' : 'text-white/40'}`}>Địa chỉ</span>
                    </div>
                </div>

                {/* Form */}
                <div className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6">
                    {/* Step 1: Personal Info */}
                    {currentStep === 1 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="block text-white/60 text-sm mb-2">Họ và tên *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-cyan-500 outline-none"
                                    placeholder="Nguyễn Văn A"
                                />
                            </div>
                            <div>
                                <label className="block text-white/60 text-sm mb-2">Số điện thoại *</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-cyan-500 outline-none"
                                    placeholder="0901234567"
                                />
                            </div>
                        </motion.div>
                    )}

                    {/* Step 2: Address */}
                    {currentStep === 2 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-4"
                        >
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-white/60 text-sm mb-2">Tỉnh/Thành phố *</label>
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
                                    <label className="block text-white/60 text-sm mb-2">Quận/Huyện *</label>
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
                                    <label className="block text-white/60 text-sm mb-2">Phường/Xã *</label>
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
                                    <label className="block text-white/60 text-sm mb-2">Địa chỉ chi tiết *</label>
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
                                        <label className="block text-white/60 text-sm mb-2">Tên người nhận *</label>
                                        <input
                                            type="text"
                                            value={formData.recipientName}
                                            onChange={e => setFormData({ ...formData, recipientName: e.target.value })}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-cyan-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-white/60 text-sm mb-2">SĐT người nhận *</label>
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
                        {currentStep === 2 && (
                            <Button variant="secondary" onClick={() => setCurrentStep(1)} className="flex-1">
                                Quay lại
                            </Button>
                        )}
                        {currentStep === 1 && (
                            <Button
                                onClick={() => {
                                    if (validateStep(1)) setCurrentStep(2);
                                }}
                                className="flex-1"
                            >
                                Tiếp tục
                            </Button>
                        )}
                        {currentStep === 2 && (
                            <Button onClick={handleSubmit} disabled={loading} className="flex-1">
                                {loading ? 'Đang lưu...' : 'Hoàn tất'}
                            </Button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
