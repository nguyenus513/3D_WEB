'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getProvinces, getDistricts, getWards, Province, District, Ward } from '@/lib/vietnam-provinces';

export interface ShippingAddress {
    id?: string;
    full_name: string;
    phone: string;
    address_line: string;
    ward?: string;
    district?: string;
    province: string;
    is_default?: boolean;
}

interface AddressSelectorProps {
    userId?: string;
    value: ShippingAddress | null;
    onChange: (address: ShippingAddress) => void;
    disabled?: boolean;
}

interface SavedAddress extends ShippingAddress {
    id: string;
    label?: string;
}

export function AddressSelector({ userId, value, onChange, disabled }: AddressSelectorProps) {
    const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
    const [loading, setLoading] = useState(false);
    const [showNewForm, setShowNewForm] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(value?.id || null);

    // Vietnam address data for new form
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [districts, setDistricts] = useState<District[]>([]);
    const [wards, setWards] = useState<Ward[]>([]);
    const [loadingAddress, setLoadingAddress] = useState(false);

    // New address form data
    const [newAddress, setNewAddress] = useState<{
        full_name: string;
        phone: string;
        address_line: string;
        provinceCode: number | null;
        provinceName: string;
        districtCode: number | null;
        districtName: string;
        wardCode: number | null;
        wardName: string;
    }>({
        full_name: '',
        phone: '',
        address_line: '',
        provinceCode: null,
        provinceName: '',
        districtCode: null,
        districtName: '',
        wardCode: null,
        wardName: '',
    });

    // Fetch saved addresses
    useEffect(() => {
        if (userId) {
            setLoading(true);
            fetch('/api/addresses')
                .then(res => res.json())
                .then(data => {
                    if (data.addresses) {
                        setSavedAddresses(data.addresses);
                        // Auto-select default address if no value
                        if (!value) {
                            const defaultAddr = data.addresses.find((a: SavedAddress) => a.is_default);
                            if (defaultAddr) {
                                setSelectedId(defaultAddr.id);
                                onChange(defaultAddr);
                            } else if (data.addresses.length > 0) {
                                setSelectedId(data.addresses[0].id);
                                onChange(data.addresses[0]);
                            } else {
                                setShowNewForm(true);
                            }
                        }
                    }
                })
                .catch(console.error)
                .finally(() => setLoading(false));
        } else {
            // Guest - always show new form
            setShowNewForm(true);
        }
    }, [userId]);

    // Load provinces
    useEffect(() => {
        getProvinces().then(setProvinces);
    }, []);

    // Load districts when province changes
    useEffect(() => {
        if (newAddress.provinceCode) {
            setLoadingAddress(true);
            getDistricts(newAddress.provinceCode).then(data => {
                setDistricts(data);
                setLoadingAddress(false);
            });
            setNewAddress(prev => ({
                ...prev,
                districtCode: null,
                districtName: '',
                wardCode: null,
                wardName: '',
            }));
            setWards([]);
        }
    }, [newAddress.provinceCode]);

    // Load wards when district changes
    useEffect(() => {
        if (newAddress.districtCode) {
            setLoadingAddress(true);
            getWards(newAddress.districtCode).then(data => {
                setWards(data);
                setLoadingAddress(false);
            });
            setNewAddress(prev => ({
                ...prev,
                wardCode: null,
                wardName: '',
            }));
        }
    }, [newAddress.districtCode]);

    const handleSelectSaved = (addr: SavedAddress) => {
        setSelectedId(addr.id);
        setShowNewForm(false);
        onChange(addr);
    };

    const handleNewAddressChange = () => {
        // Validate
        if (!newAddress.full_name || !newAddress.phone || !newAddress.provinceName || !newAddress.address_line) {
            return;
        }

        onChange({
            full_name: newAddress.full_name,
            phone: newAddress.phone,
            address_line: newAddress.address_line,
            ward: newAddress.wardName,
            district: newAddress.districtName,
            province: newAddress.provinceName,
        });
    };

    useEffect(() => {
        if (showNewForm && newAddress.full_name && newAddress.phone && newAddress.provinceName) {
            handleNewAddressChange();
        }
    }, [newAddress, showNewForm]);

    if (loading) {
        return (
            <div className="p-4 bg-white/5 rounded-xl animate-pulse">
                <div className="h-4 bg-white/10 rounded w-1/2 mb-2" />
                <div className="h-4 bg-white/10 rounded w-3/4" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Saved Addresses */}
            {savedAddresses.length > 0 && !showNewForm && (
                <div className="space-y-3">
                    <p className="text-white/60 text-sm">Chọn địa chỉ đã lưu:</p>
                    {savedAddresses.map(addr => (
                        <button
                            key={addr.id}
                            onClick={() => handleSelectSaved(addr)}
                            disabled={disabled}
                            className={`w-full p-4 rounded-xl border text-left transition-all ${selectedId === addr.id
                                    ? 'border-cyan-500 bg-cyan-500/10'
                                    : 'border-white/10 bg-white/5 hover:border-white/20'
                                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium">{addr.full_name}</p>
                                    <p className="text-white/60 text-sm">{addr.phone}</p>
                                    <p className="text-white/50 text-sm truncate">
                                        {addr.address_line}, {addr.ward}, {addr.district}, {addr.province}
                                    </p>
                                </div>
                                {selectedId === addr.id && (
                                    <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            {addr.is_default && (
                                <span className="inline-block mt-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                                    Mặc định
                                </span>
                            )}
                        </button>
                    ))}
                    <button
                        onClick={() => {
                            setShowNewForm(true);
                            setSelectedId(null);
                        }}
                        disabled={disabled}
                        className="w-full p-4 rounded-xl border border-dashed border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Thêm địa chỉ mới
                    </button>
                </div>
            )}

            {/* New Address Form */}
            <AnimatePresence>
                {showNewForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4"
                    >
                        {savedAddresses.length > 0 && (
                            <div className="flex items-center justify-between">
                                <p className="text-white/60 text-sm">Nhập địa chỉ mới:</p>
                                <button
                                    onClick={() => setShowNewForm(false)}
                                    className="text-cyan-400 text-sm hover:text-cyan-300"
                                >
                                    ← Chọn địa chỉ đã lưu
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <input
                                type="text"
                                placeholder="Họ tên người nhận *"
                                value={newAddress.full_name}
                                onChange={e => setNewAddress(prev => ({ ...prev, full_name: e.target.value }))}
                                disabled={disabled}
                                className="col-span-1 p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:border-cyan-500 focus:outline-none"
                            />
                            <input
                                type="tel"
                                placeholder="Số điện thoại *"
                                value={newAddress.phone}
                                onChange={e => setNewAddress(prev => ({ ...prev, phone: e.target.value }))}
                                disabled={disabled}
                                className="col-span-1 p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:border-cyan-500 focus:outline-none"
                            />
                        </div>

                        {/* Province/District/Ward selectors */}
                        <div className="grid grid-cols-3 gap-3">
                            <select
                                value={newAddress.provinceCode || ''}
                                onChange={e => {
                                    const p = provinces.find(x => x.code === Number(e.target.value));
                                    setNewAddress(prev => ({
                                        ...prev,
                                        provinceCode: p?.code || null,
                                        provinceName: p?.name || '',
                                    }));
                                }}
                                disabled={disabled || loadingAddress}
                                className="p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-cyan-500 focus:outline-none"
                            >
                                <option value="">Tỉnh/Thành *</option>
                                {provinces.map(p => (
                                    <option key={p.code} value={p.code} className="bg-[#1d1d1f] text-white">
                                        {p.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={newAddress.districtCode || ''}
                                onChange={e => {
                                    const d = districts.find(x => x.code === Number(e.target.value));
                                    setNewAddress(prev => ({
                                        ...prev,
                                        districtCode: d?.code || null,
                                        districtName: d?.name || '',
                                    }));
                                }}
                                disabled={disabled || !newAddress.provinceCode || loadingAddress}
                                className="p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                            >
                                <option value="">Quận/Huyện</option>
                                {districts.map(d => (
                                    <option key={d.code} value={d.code} className="bg-[#1d1d1f] text-white">
                                        {d.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={newAddress.wardCode || ''}
                                onChange={e => {
                                    const w = wards.find(x => x.code === Number(e.target.value));
                                    setNewAddress(prev => ({
                                        ...prev,
                                        wardCode: w?.code || null,
                                        wardName: w?.name || '',
                                    }));
                                }}
                                disabled={disabled || !newAddress.districtCode || loadingAddress}
                                className="p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                            >
                                <option value="">Phường/Xã</option>
                                {wards.map(w => (
                                    <option key={w.code} value={w.code} className="bg-[#1d1d1f] text-white">
                                        {w.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <input
                            type="text"
                            placeholder="Địa chỉ cụ thể (số nhà, đường, ...) *"
                            value={newAddress.address_line}
                            onChange={e => setNewAddress(prev => ({ ...prev, address_line: e.target.value }))}
                            disabled={disabled}
                            className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:border-cyan-500 focus:outline-none"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
