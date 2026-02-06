'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { getProvinces, getDistricts, getWards, Province, District, Ward } from '@/lib/vietnam-provinces';
import { addCsrfToRequest } from '@/lib/security/csrf-client';

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
}

export default function CompleteProfilePage() {
    const { data: session, status, update } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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

    // Redirect if not authenticated
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    const validateForm = (): boolean => {
        setError('');
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
        // Safety check for names
        if (!formData.districtName && formData.districtCode) {
            const d = districts.find(x => x.code === formData.districtCode);
            if (d) {
                setFormData(prev => ({ ...prev, districtName: d.name }));
            }
        }
        if (!formData.wardName && formData.wardCode) {
            const w = wards.find(x => x.code === formData.wardCode);
            if (w) {
                setFormData(prev => ({ ...prev, wardName: w.name }));
            }
        }
        if (!formData.addressLine) {
            setError('Vui lòng nhập địa chỉ chi tiết');
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setLoading(true);
        setError('');

        try {
            // Update profile
            const profileRes = await fetch('/api/profile', {
                method: 'PUT',
                headers: addCsrfToRequest({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    name: formData.name,
                    phone: formData.phone,
                }),
            });

            if (!profileRes.ok) {
                const data = await profileRes.json();
                throw new Error(data.error || 'Không thể cập nhật hồ sơ');
            }

            // Robustly resolve names even if state is stale
            let finalProvinceName = formData.provinceName;
            let finalDistrictName = formData.districtName;
            let finalWardName = formData.wardName;

            if (!finalProvinceName && formData.provinceCode) {
                const ps = await getProvinces();
                finalProvinceName = ps.find(p => p.code === formData.provinceCode)?.name || '';
            }

            if (!finalDistrictName && formData.districtCode && formData.provinceCode) {
                const ds = await getDistricts(formData.provinceCode);
                finalDistrictName = ds.find(d => d.code === formData.districtCode)?.name || '';
            }

            if (!finalWardName && formData.wardCode && formData.districtCode) {
                const ws = await getWards(formData.districtCode);
                finalWardName = ws.find(w => w.code === formData.wardCode)?.name || '';
            }

            // Create address
            const addressRes = await fetch('/api/addresses', {
                method: 'POST',
                headers: addCsrfToRequest({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    label: 'Nhà riêng',
                    full_name: formData.name,
                    phone: formData.phone,
                    address_line: formData.addressLine,
                    ward: finalWardName,
                    district: finalDistrictName,
                    province: finalProvinceName,
                    is_default: true,
                }),
            });

            if (!addressRes.ok) {
                const errorData = await addressRes.json();
                console.error('Address creation failed:', errorData);
                throw new Error(errorData.error || 'Không thể tạo địa chỉ');
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

                {/* Form */}
                <div className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-6">
                    {/* Personal Info */}
                    <div className="space-y-4">
                        <h3 className="text-white font-medium">Thông tin cá nhân</h3>
                        <div className="grid grid-cols-2 gap-4">
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
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-white/10" />

                    {/* Address */}
                    <div className="space-y-4">
                        <h3 className="text-white font-medium">Địa chỉ giao hàng</h3>
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
                    </div>

                    {/* Error */}
                    {error && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-red-400 text-sm"
                        >
                            {error}
                        </motion.p>
                    )}

                    {/* Submit Button */}
                    <Button onClick={handleSubmit} disabled={loading} className="w-full">
                        {loading ? 'Đang lưu...' : 'Hoàn tất'}
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
