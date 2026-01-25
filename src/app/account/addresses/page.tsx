'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { getProvinces, getDistricts, getWards, Province, District, Ward } from '@/lib/vietnam-provinces';

interface Address {
    id: string;
    user_id: string;
    label: string;
    full_name: string;
    phone: string;
    address_line: string;
    ward: string;
    district: string;
    province: string;
    is_default: boolean;
}

interface FormData {
    full_name: string;
    phone: string;
    address_line: string;
    provinceCode: number | null;
    provinceName: string;
    districtCode: number | null;
    districtName: string;
    wardCode: number | null;
    wardName: string;
    is_default: boolean;
}

const initialFormData: FormData = {
    full_name: '',
    phone: '',
    address_line: '',
    provinceCode: null,
    provinceName: '',
    districtCode: null,
    districtName: '',
    wardCode: null,
    wardName: '',
    is_default: false,
};

export default function AccountAddressesPage() {
    const { data: session, status } = useSession();
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<FormData>(initialFormData);

    // Vietnam address data
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [districts, setDistricts] = useState<District[]>([]);
    const [wards, setWards] = useState<Ward[]>([]);
    const [loadingAddress, setLoadingAddress] = useState(false);

    // Flag to prevent useEffects from resetting values during edit
    const [isEditMode, setIsEditMode] = useState(false);

    // Load provinces on mount
    useEffect(() => {
        getProvinces().then(setProvinces);
    }, []);

    // Load districts when province changes (only reset when creating new, not editing)
    useEffect(() => {
        if (formData.provinceCode) {
            setLoadingAddress(true);
            getDistricts(formData.provinceCode).then(data => {
                setDistricts(data);
                setLoadingAddress(false);
            });
            // Only reset if NOT editing an existing address
            if (!editingId) {
                setFormData(prev => ({
                    ...prev,
                    districtCode: null,
                    districtName: '',
                    wardCode: null,
                    wardName: '',
                }));
                setWards([]);
            }
        }
    }, [formData.provinceCode, editingId]);

    // Load wards when district changes (only reset when creating new, not editing)
    useEffect(() => {
        if (formData.districtCode) {
            setLoadingAddress(true);
            getWards(formData.districtCode).then(data => {
                setWards(data);
                setLoadingAddress(false);
            });
            // Only reset if NOT editing an existing address
            if (!editingId) {
                setFormData(prev => ({
                    ...prev,
                    wardCode: null,
                    wardName: '',
                }));
            }
        }
    }, [formData.districtCode, editingId]);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchAddresses();
        } else if (status === 'unauthenticated') {
            setLoading(false);
        }
    }, [status]);

    const fetchAddresses = async () => {
        try {
            const res = await fetch('/api/addresses');
            const data = await res.json();
            if (data.addresses) {
                setAddresses(data.addresses);
            }
        } catch (error) {
            console.error('Fetch addresses error:', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteAddress = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa địa chỉ này?')) return;

        try {
            await fetch(`/api/addresses?id=${id}`, { method: 'DELETE' });
            setAddresses(addresses.filter(a => a.id !== id));
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const payload = {
                full_name: formData.full_name,
                phone: formData.phone,
                address_line: formData.address_line,
                ward: formData.wardName,
                district: formData.districtName,
                province: formData.provinceName,
                label: 'Địa chỉ giao hàng',
                is_default: formData.is_default,
            };

            if (editingId) {
                const res = await fetch('/api/addresses', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingId, ...payload }),
                });

                if (res.ok) {
                    closeForm();
                    fetchAddresses();
                }
            } else {
                const res = await fetch('/api/addresses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...payload,
                        // First address is always default, otherwise use checkbox value
                        is_default: addresses.length === 0 ? true : formData.is_default,
                    }),
                });

                if (res.ok) {
                    closeForm();
                    fetchAddresses();
                }
            }
        } catch (error) {
            console.error('Submit error:', error);
        } finally {
            setSaving(false);
        }
    };

    const openEditForm = async (address: Address) => {
        // Set edit mode to prevent useEffects from resetting values
        setIsEditMode(true);

        // Find province by name
        const province = provinces.find(p => p.name === address.province);

        let districtsList: District[] = [];
        let wardsList: Ward[] = [];
        let districtCode: number | null = null;
        let wardCode: number | null = null;

        // Load districts if province found
        if (province?.code) {
            districtsList = await getDistricts(province.code);
            setDistricts(districtsList);

            // Find district by name
            const district = districtsList.find(d => d.name === address.district);
            districtCode = district?.code || null;

            // Load wards if district found
            if (district?.code) {
                wardsList = await getWards(district.code);
                setWards(wardsList);

                // Find ward by name
                const ward = wardsList.find(w => w.name === address.ward);
                wardCode = ward?.code || null;
            }
        }

        setFormData({
            full_name: address.full_name || '',
            phone: address.phone || '',
            address_line: address.address_line || '',
            provinceCode: province?.code || null,
            provinceName: address.province || '',
            districtCode,
            districtName: address.district || '',
            wardCode,
            wardName: address.ward || '',
            is_default: address.is_default || false,
        });
        setEditingId(address.id);
        setShowForm(true);
    };


    const closeForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData(initialFormData);
        setDistricts([]);
        setWards([]);
    };

    if (status === 'loading' || loading) {
        return (
            <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Địa chỉ giao hàng</h1>
                    <p className="text-white/50 mt-1">
                        {addresses.length} địa chỉ
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black font-medium hover:bg-white/90"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Thêm địa chỉ
                </button>
            </div>

            {/* Addresses list */}
            <div className="space-y-4">
                {addresses.map((address, index) => (
                    <motion.div
                        key={address.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`bg-white/5 backdrop-blur-xl rounded-2xl border p-5 ${address.is_default ? 'border-white/30' : 'border-white/10'
                            }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                {/* Header with badge */}
                                {address.is_default && (
                                    <div className="mb-3">
                                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                                            Mặc định
                                        </span>
                                    </div>
                                )}

                                {/* Contact Info */}
                                <div className="space-y-1.5">
                                    <p className="text-white font-medium">{address.full_name}</p>
                                    <p className="text-white/60">{address.phone}</p>
                                </div>

                                {/* Full Address */}
                                <div className="mt-3 pt-3 border-t border-white/10">
                                    <p className="text-white/70">{address.address_line}</p>
                                    <p className="text-white/50 text-sm mt-1">
                                        {[address.ward, address.district, address.province].filter(Boolean).join(', ')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => openEditForm(address)}
                                    className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"
                                    title="Sửa địa chỉ"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                                {!address.is_default && (
                                    <button
                                        onClick={() => deleteAddress(address.id)}
                                        className="p-2 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400"
                                        title="Xóa địa chỉ"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}

                {addresses.length === 0 && (
                    <div className="text-center py-12 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
                        <p className="text-white/50 mb-4">Chưa có địa chỉ nào</p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="px-6 py-2 bg-white text-black rounded-xl font-medium"
                        >
                            Thêm địa chỉ đầu tiên
                        </button>
                    </div>
                )}
            </div>

            {/* Add/Edit address form modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-[#1a1a1b] backdrop-blur-xl rounded-2xl border border-white/10 p-6 max-h-[90vh] overflow-y-auto"
                    >
                        <h2 className="text-xl font-bold text-white mb-6">
                            {editingId ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Người nhận */}
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Người nhận *</label>
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="Họ tên người nhận"
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40"
                                    required
                                />
                            </div>

                            {/* Số điện thoại */}
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Số điện thoại *</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="0901234567"
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40"
                                    required
                                />
                            </div>

                            {/* Tỉnh/Thành phố */}
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Tỉnh/Thành phố *</label>
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
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white appearance-none cursor-pointer"
                                    required
                                >
                                    <option value="" className="bg-[#1D1D1F]">Chọn Tỉnh/Thành phố</option>
                                    {provinces.map(p => (
                                        <option key={p.code} value={p.code} className="bg-[#1D1D1F]">{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Quận/Huyện */}
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Quận/Huyện *</label>
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
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white appearance-none cursor-pointer disabled:opacity-50"
                                    required
                                >
                                    <option value="" className="bg-[#1D1D1F]">
                                        {loadingAddress ? 'Đang tải...' : 'Chọn Quận/Huyện'}
                                    </option>
                                    {districts.map(d => (
                                        <option key={d.code} value={d.code} className="bg-[#1D1D1F]">{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Phường/Xã */}
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Phường/Xã *</label>
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
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white appearance-none cursor-pointer disabled:opacity-50"
                                    required
                                >
                                    <option value="" className="bg-[#1D1D1F]">
                                        {loadingAddress ? 'Đang tải...' : 'Chọn Phường/Xã'}
                                    </option>
                                    {wards.map(w => (
                                        <option key={w.code} value={w.code} className="bg-[#1D1D1F]">{w.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Địa chỉ chi tiết */}
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Địa chỉ chi tiết *</label>
                                <input
                                    type="text"
                                    value={formData.address_line}
                                    onChange={(e) => setFormData({ ...formData, address_line: e.target.value })}
                                    placeholder="Số nhà, đường, ngõ..."
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40"
                                    required
                                />
                            </div>

                            {/* Đặt làm mặc định */}
                            <div className="flex items-center gap-3 pt-2">
                                <input
                                    type="checkbox"
                                    id="is_default"
                                    checked={formData.is_default}
                                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                                    className="w-5 h-5 rounded border-white/20 bg-[#0a0a0a] text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                                />
                                <label htmlFor="is_default" className="text-white/70 text-sm cursor-pointer">
                                    Đặt làm địa chỉ mặc định
                                </label>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 disabled:opacity-50"
                                >
                                    {saving ? 'Đang lưu...' : 'Lưu địa chỉ'}
                                </button>
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    className="px-6 py-3 rounded-xl border border-white/20 text-white/70 hover:text-white"
                                >
                                    Hủy
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
