'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase/client';
import type { Address } from '@/types/database';

export default function AccountAddressesPage() {
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        label: '',
        full_name: '',
        phone: '',
        address_line: '',
        province: '',
    });

    useEffect(() => {
        fetchAddresses();
    }, []);

    const fetchAddresses = async () => {
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('addresses')
            .select('*')
            .eq('user_id', user.id)
            .order('is_default', { ascending: false });

        if (!error && data) {
            setAddresses(data);
        }
        setLoading(false);
    };

    const setDefault = async (id: string) => {
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Reset all to non-default
        await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
        // Set selected as default
        await supabase.from('addresses').update({ is_default: true }).eq('id', id);

        fetchAddresses();
    };

    const deleteAddress = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa địa chỉ này?')) return;

        const supabase = getSupabase();
        await supabase.from('addresses').delete().eq('id', id);
        setAddresses(addresses.filter(a => a.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setSaving(false);
            return;
        }

        const { error } = await supabase.from('addresses').insert({
            user_id: user.id,
            label: formData.label,
            full_name: formData.full_name,
            phone: formData.phone,
            address_line: formData.address_line,
            province: formData.province || 'TP.HCM',
            is_default: addresses.length === 0,
        });

        if (!error) {
            setShowForm(false);
            setFormData({ label: '', full_name: '', phone: '', address_line: '', province: '' });
            fetchAddresses();
        }
        setSaving(false);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Địa chỉ giao hàng</h1>
                    <p className="text-white/50 mt-1">
                        {loading ? 'Đang tải...' : `${addresses.length} địa chỉ`}
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

            {/* Loading */}
            {loading && (
                <div className="p-12 text-center">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
                </div>
            )}

            {/* Addresses list */}
            {!loading && (
                <div className="space-y-4">
                    {addresses.map((address, index) => (
                        <motion.div
                            key={address.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`bg-[#1D1D1F] rounded-2xl border p-5 ${address.is_default ? 'border-white/30' : 'border-white/10'
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <h3 className="text-white font-semibold">{address.label || 'Địa chỉ'}</h3>
                                        {address.is_default && (
                                            <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs">
                                                Mặc định
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-white">{address.full_name}</p>
                                    <p className="text-white/70">{address.phone}</p>
                                    <p className="text-white/50 mt-2">{address.address_line}</p>
                                    {address.province && <p className="text-white/50">{address.province}</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                    {!address.is_default && (
                                        <button
                                            onClick={() => deleteAddress(address.id)}
                                            className="p-2 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400"
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
                        <div className="text-center py-12 bg-[#1D1D1F] rounded-2xl border border-white/10">
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
            )}

            {/* Add address form modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-xl font-bold text-white mb-6">Thêm địa chỉ mới</h2>
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
                                    onClick={() => setShowForm(false)}
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
