'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Mock customer data
const mockCustomer = {
    id: 'CUS-A7K3M9',
    name: 'Nguyễn Văn A',
    email: 'nguyenvana@gmail.com',
    phone: '0901234567',
    address: '123 Nguyễn Huệ, Q1, TP.HCM',
    createdAt: '10/01/2026',
    totalOrders: 15,
    totalSpent: 12500000,
    status: 'active',
    notes: 'Khách hàng thân thiết, hay mua figure anime',
};

const mockOrders = [
    { id: 'ORD-B2N8P4', date: '15/01/2026', total: 850000, status: 'completed', items: 2 },
    { id: 'ORD-K5J2H8', date: '10/01/2026', total: 350000, status: 'completed', items: 1 },
    { id: 'ORD-M4R7S2', date: '05/01/2026', total: 1200000, status: 'completed', items: 3 },
];

const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    inactive: 'bg-gray-500/20 text-gray-400',
    blocked: 'bg-red-500/20 text-red-400',
};

export default function AdminCustomerDetailPage() {
    const router = useRouter();
    const params = useParams();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({ ...mockCustomer });

    const handleSave = async () => {
        setIsSaving(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Save customer:', formData);
        setIsSaving(false);
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (confirm('Bạn có chắc muốn xóa khách hàng này? Thao tác này không thể hoàn tác.')) {
            console.log('Delete customer:', params.id);
            router.push('/admin/customers');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/customers"
                        className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{formData.name}</h1>
                        <p className="text-white/50 mt-1">ID: {formData.id}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isEditing ? (
                        <>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 rounded-xl border border-white/20 text-white/70 hover:text-white transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-4 py-2 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
                            >
                                {isSaving ? 'Đang lưu...' : 'Lưu'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Chỉnh sửa
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Xóa
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="lg:col-span-2 bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-5"
                >
                    <h2 className="text-lg font-semibold text-white">Thông tin khách hàng</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-white/50 text-sm block mb-1">Họ tên</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                                />
                            ) : (
                                <p className="text-white font-medium">{formData.name}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-white/50 text-sm block mb-1">Email</label>
                            {isEditing ? (
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                                />
                            ) : (
                                <p className="text-white">{formData.email}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-white/50 text-sm block mb-1">Số điện thoại</label>
                            {isEditing ? (
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                                />
                            ) : (
                                <p className="text-white">{formData.phone}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-white/50 text-sm block mb-1">Trạng thái</label>
                            {isEditing ? (
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                                >
                                    <option value="active">Hoạt động</option>
                                    <option value="inactive">Không hoạt động</option>
                                    <option value="blocked">Đã chặn</option>
                                </select>
                            ) : (
                                <span className={`px-3 py-1 rounded-full text-sm ${statusColors[formData.status]}`}>
                                    {formData.status === 'active' ? 'Hoạt động' : formData.status === 'inactive' ? 'Không hoạt động' : 'Đã chặn'}
                                </span>
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-white/50 text-sm block mb-1">Địa chỉ</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                                />
                            ) : (
                                <p className="text-white">{formData.address}</p>
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-white/50 text-sm block mb-1">Ghi chú</label>
                            {isEditing ? (
                                <textarea
                                    rows={3}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
                                />
                            ) : (
                                <p className="text-white/70">{formData.notes || 'Không có ghi chú'}</p>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Stats sidebar */}
                <div className="space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h3 className="text-white/70 text-sm mb-4">Thống kê</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <span className="text-white/50">Tổng đơn hàng</span>
                                <span className="text-white font-medium">{formData.totalOrders}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/50">Tổng chi tiêu</span>
                                <span className="text-white font-medium">{formData.totalSpent.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/50">Đơn TB</span>
                                <span className="text-white font-medium">{Math.round(formData.totalSpent / formData.totalOrders).toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/50">Thành viên từ</span>
                                <span className="text-white">{formData.createdAt}</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Order history */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
            >
                <h2 className="text-lg font-semibold text-white mb-4">Lịch sử đơn hàng</h2>
                <div className="space-y-3">
                    {mockOrders.map((order) => (
                        <Link
                            key={order.id}
                            href={`/admin/orders/${order.id.replace('ORD-', '')}`}
                            className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <span className="text-white font-medium">{order.id}</span>
                                <span className="text-white/50 text-sm">{order.date}</span>
                                <span className="text-white/50 text-sm">{order.items} sản phẩm</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-white font-medium">{order.total.toLocaleString('vi-VN')}đ</span>
                                <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs">
                                    Hoàn thành
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
