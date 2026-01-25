'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';

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

export default function AccountAddressesPage() {
    const { data: session, status } = useSession();
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        label: '',
        full_name: '',
        phone: '',
        address_line: '',
        province: '',
    });

    useEffect(() => {
        if (status === 'authenticated') {
            fetchAddresses();
        } else if (status === 'unauthenticated') {
            setLoading(false);
        }
    }, [status]);

    // Fetch via secure API
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

    // Set default via API
    const setDefault = async (id: string) => {
        try {
            await fetch('/api/addresses', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_default: true }),
            });
            fetchAddresses();
        } catch (error) {
            console.error('Set default error:', error);
        }
    };

    // Delete via API
    const deleteAddress = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa địa chỉ này?')) return;

        try {
            await fetch(`/api/addresses?id=${id}`, { method: 'DELETE' });
            setAddresses(addresses.filter(a => a.id !== id));
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    // Create or Update via API
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            if (editingId) {
                // Update existing address
                const res = await fetch('/api/addresses', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: editingId,
                        ...formData,
                    }),
                });

                if (res.ok) {
                    closeForm();
                    fetchAddresses();
                }
            } else {
                // Create new address
                const res = await fetch('/api/addresses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...formData,
                        is_default: addresses.length === 0,
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

    // Open form for editing
    const openEditForm = (address: Address) => {
        setFormData({
            label: address.label || '',
            full_name: address.full_name || '',
            phone: address.phone || '',
            address_line: address.address_line || '',
            province: address.province || '',
        });
        setEditingId(address.id);
        setShowForm(true);
    };

    // Close form and reset state
    const closeForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData({ label: '', full_name: '', phone: '', address_line: '', province: '' });
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
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-white font-semibold">{address.label || 'Địa chỉ'}</h3>
                                        {address.is_default && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs mt-1">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                                Mặc định
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Contact Info */}
                                <div className="ml-13 pl-0.5 space-y-2 border-l-2 border-white/10 ml-5 pl-5">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <span className="text-white font-medium">{address.full_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                        <span className="text-white/70">{address.phone}</span>
                                    </div>

                                    {/* Full Address */}
                                    <div className="flex gap-2 mt-3">
                                        <svg className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        </svg>
                                        <div className="text-white/60 text-sm">
                                            <p className="text-white/80">{address.address_line}</p>
                                            <p>{[address.ward, address.district, address.province].filter(Boolean).join(', ')}</p>
                                        </div>
                                    </div>
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

                        {!address.is_default && (
                            <button
                                onClick={() => setDefault(address.id)}
                                className="mt-4 text-sm text-white/50 hover:text-white"
                            >
                                Đặt làm mặc định
                            </button>
                        )}
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

            {/* Add address form modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-[#1a1a1b] backdrop-blur-xl rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-xl font-bold text-white mb-6">
                            {editingId ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Tên địa chỉ</label>
                                <input
                                    type="text"
                                    value={formData.label}
                                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                    placeholder="VD: Nhà riêng, Văn phòng..."
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Người nhận</label>
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="Họ tên người nhận"
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Số điện thoại</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="0901234567"
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Địa chỉ</label>
                                <textarea
                                    rows={2}
                                    value={formData.address_line}
                                    onChange={(e) => setFormData({ ...formData, address_line: e.target.value })}
                                    placeholder="Số nhà, đường, phường/xã"
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 resize-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Tỉnh/Thành phố</label>
                                <input
                                    type="text"
                                    value={formData.province}
                                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                                    placeholder="VD: TP.HCM"
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40"
                                />
                            </div>
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
