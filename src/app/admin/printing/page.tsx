'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Mock printing orders
const printingOrders = [
    { id: '#P001', customer: 'Lê Văn C', file: 'dragon_model.stl', size: '15x10x8 cm', material: 'Resin', color: 'Xám', status: 'processing', price: 450000, date: '15/01/2026' },
    { id: '#P002', customer: 'Trần Thị D', file: 'phone_stand.stl', size: '8x5x3 cm', material: 'PLA', color: 'Đen', status: 'pending', price: 120000, date: '14/01/2026' },
    { id: '#P003', customer: 'Nguyễn Văn E', file: 'chess_set.stl', size: '30x30x5 cm', material: 'Resin', color: 'Trắng', status: 'completed', price: 850000, date: '13/01/2026' },
];

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    processing: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ báo giá',
    processing: 'Đang in',
    completed: 'Hoàn thành',
};

export default function AdminPrintingPage() {
    const [orders] = useState(printingOrders);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Đơn in 3D</h1>
                <p className="text-white/50 mt-1">Quản lý đơn hàng dịch vụ in 3D</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Chờ báo giá</p>
                    <p className="text-2xl font-bold text-yellow-400 mt-1">3</p>
                </div>
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Đang in</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">5</p>
                </div>
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Hoàn thành tháng này</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">28</p>
                </div>
            </div>

            {/* Orders table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 overflow-hidden"
            >
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Mã đơn</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Khách hàng</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">File</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Vật liệu</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Giá</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Trạng thái</th>
                            <th className="text-right text-white/50 text-sm font-medium px-5 py-4">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order) => (
                            <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="px-5 py-4 text-white font-medium">{order.id}</td>
                                <td className="px-5 py-4 text-white/70">{order.customer}</td>
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span className="text-white/70">{order.file}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <span className="px-2 py-1 rounded bg-white/10 text-white/70 text-sm">
                                        {order.material} / {order.color}
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-white">{order.price.toLocaleString('vi-VN')}đ</td>
                                <td className="px-5 py-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                                        {statusLabels[order.status]}
                                    </span>
                                </td>
                                <td className="px-5 py-4">
                                    <div className="flex items-center justify-end gap-2">
                                        <button className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:text-white text-sm transition-colors">
                                            Chi tiết
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </motion.div>
        </div>
    );
}
