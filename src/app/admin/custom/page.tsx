'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Mock custom orders
const customOrders = [
    { id: '#C001', customer: 'Nguyễn Văn A', type: 'Couple', photos: 3, size: 'M (15cm)', accessories: 2, status: 'review', price: 850000, date: '15/01/2026' },
    { id: '#C002', customer: 'Trần Thị B', type: 'Single', photos: 2, size: 'L (20cm)', accessories: 0, status: 'processing', price: 450000, date: '14/01/2026' },
    { id: '#C003', customer: 'Phạm Văn C', type: 'Group', photos: 5, size: 'M (15cm)', accessories: 3, status: 'pending', price: 1200000, date: '13/01/2026' },
];

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    processing: 'bg-blue-500/20 text-blue-400',
    review: 'bg-purple-500/20 text-purple-400',
    confirmed: 'bg-green-500/20 text-green-400',
    completed: 'bg-green-500/20 text-green-400',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ xác nhận',
    processing: 'Đang thiết kế',
    review: 'Chờ duyệt mẫu',
    confirmed: 'Đã duyệt',
    completed: 'Hoàn thành',
};

export default function AdminCustomPage() {
    const [orders] = useState(customOrders);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Đơn Custom</h1>
                <p className="text-white/50 mt-1">Quản lý đơn hàng thiết kế theo yêu cầu</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Chờ xác nhận</p>
                    <p className="text-2xl font-bold text-yellow-400 mt-1">5</p>
                </div>
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Đang thiết kế</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">8</p>
                </div>
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Chờ duyệt</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">3</p>
                </div>
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Hoàn thành</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">42</p>
                </div>
            </div>

            {/* Orders list */}
            <div className="space-y-4">
                {orders.map((order, index) => (
                    <motion.div
                        key={order.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-5"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex gap-4">
                                {/* Photos preview */}
                                <div className="flex -space-x-2">
                                    {[...Array(Math.min(order.photos, 3))].map((_, i) => (
                                        <div key={i} className="w-12 h-12 rounded-xl bg-white/10 border-2 border-[#1D1D1F] flex items-center justify-center">
                                            <svg className="w-5 h-5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                    ))}
                                    {order.photos > 3 && (
                                        <div className="w-12 h-12 rounded-xl bg-white/20 border-2 border-[#1D1D1F] flex items-center justify-center">
                                            <span className="text-white/70 text-xs">+{order.photos - 3}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="text-white font-semibold">{order.id}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                                            {statusLabels[order.status]}
                                        </span>
                                    </div>
                                    <p className="text-white/70">{order.customer}</p>
                                    <div className="flex items-center gap-4 mt-2 text-sm text-white/50">
                                        <span>Loại: {order.type}</span>
                                        <span>Size: {order.size}</span>
                                        <span>Phụ kiện: {order.accessories}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <p className="text-white font-semibold">{order.price.toLocaleString('vi-VN')}đ</p>
                                <p className="text-white/50 text-sm mt-1">{order.date}</p>
                                <Link
                                    href={`/admin/orders/${order.id.replace('#', '')}`}
                                    className="inline-block mt-3 px-4 py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
                                >
                                    Chi tiết
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
