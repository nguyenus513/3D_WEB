'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

// Mock addresses
const initialAddresses = [
    { id: 1, name: 'Nhà riêng', recipient: 'Nguyễn Văn A', phone: '0901234567', address: '123 Nguyễn Văn Linh, Quận 7, TP.HCM', isDefault: true },
    { id: 2, name: 'Văn phòng', recipient: 'Nguyễn Văn A', phone: '0901234567', address: '456 Lê Văn Việt, Quận 9, TP.HCM', isDefault: false },
];

export default function AccountAddressesPage() {
    const [addresses, setAddresses] = useState(initialAddresses);
    const [showForm, setShowForm] = useState(false);

    const setDefault = (id: number) => {
        setAddresses(addresses.map(addr => ({
            ...addr,
            isDefault: addr.id === id
        })));
    };

    const deleteAddress = (id: number) => {
        setAddresses(addresses.filter(addr => addr.id !== id));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Địa chỉ giao hàng</h1>
                    <p className="text-white/50 mt-1">Quản lý địa chỉ nhận hàng</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors"
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
                        transition={{ delay: index * 0.1 }}
                        className={`bg-[#1D1D1F] rounded-2xl border p-5 ${address.isDefault ? 'border-white/30' : 'border-white/10'
                            }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                    <h3 className="text-white font-semibold">{address.name}</h3>
                                    {address.isDefault && (
                                        <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs">
                                            Mặc định
                                        </span>
                                    )}
                                </div>
                                <p className="text-white">{address.recipient}</p>
                                <p className="text-white/70">{address.phone}</p>
                                <p className="text-white/50 mt-2">{address.address}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                                {!address.isDefault && (
                                    <button
                                        onClick={() => deleteAddress(address.id)}
                                        className="p-2 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        {!address.isDefault && (
                            <button
                                onClick={() => setDefault(address.id)}
                                className="mt-4 text-sm text-white/50 hover:text-white transition-colors"
                            >
                                Đặt làm mặc định
                            </button>
                        )}
                    </motion.div>
                ))}
            </div>

            {/* Add address form modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-xl font-bold text-white mb-6">Thêm địa chỉ mới</h2>
                        <form className="space-y-4">
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Tên địa chỉ</label>
                                <input
                                    type="text"
                                    placeholder="VD: Nhà riêng, Văn phòng..."
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                                />
                            </div>
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Người nhận</label>
                                <input
                                    type="text"
                                    placeholder="Họ tên người nhận"
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                                />
                            </div>
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Số điện thoại</label>
                                <input
                                    type="tel"
                                    placeholder="0901234567"
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                                />
                            </div>
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Địa chỉ</label>
                                <textarea
                                    rows={3}
                                    placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors"
                                >
                                    Lưu địa chỉ
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-6 py-3 rounded-xl border border-white/20 text-white/70 hover:text-white transition-colors"
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
