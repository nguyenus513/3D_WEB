'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Mock orders data
const orders = [
    { id: '#1001', customer: 'Nguyễn Văn A', email: 'nguyenvana@gmail.com', type: 'custom', items: 2, total: 850000, status: 'pending', date: '15/01/2026' },
    { id: '#1002', customer: 'Trần Thị B', email: 'tranthib@gmail.com', type: 'product', items: 1, total: 350000, status: 'processing', date: '15/01/2026' },
    { id: '#1003', customer: 'Lê Văn C', email: 'levanc@gmail.com', type: 'printing', items: 3, total: 1200000, status: 'completed', date: '14/01/2026' },
    { id: '#1004', customer: 'Phạm Thị D', email: 'phamthid@gmail.com', type: 'custom', items: 1, total: 650000, status: 'pending', date: '14/01/2026' },
    { id: '#1005', customer: 'Hoàng Văn E', email: 'hoangvane@gmail.com', type: 'product', items: 2, total: 280000, status: 'completed', date: '13/01/2026' },
    { id: '#1006', customer: 'Vũ Thị F', email: 'vuthif@gmail.com', type: 'printing', items: 1, total: 500000, status: 'cancelled', date: '13/01/2026' },
];

const tabs = [
    { key: 'all', label: 'Tất cả', count: 6 },
    { key: 'pending', label: 'Chờ xử lý', count: 2 },
    { key: 'processing', label: 'Đang xử lý', count: 1 },
    { key: 'completed', label: 'Hoàn thành', count: 2 },
    { key: 'cancelled', label: 'Đã hủy', count: 1 },
];

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    processing: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
};

const typeLabels: Record<string, string> = {
    product: 'Sản phẩm',
    custom: 'Custom',
    printing: 'In 3D',
};

export default function AdminOrdersPage() {
    const [activeTab, setActiveTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredOrders = orders.filter(order => {
        const matchesTab = activeTab === 'all' || order.status === activeTab;
        const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customer.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesTab && matchesSearch;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Đơn hàng</h1>
                    <p className="text-white/50 mt-1">Quản lý tất cả đơn hàng</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-[#1D1D1F] border border-white/10 rounded-xl text-white/70 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Xuất Excel
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.key
                                ? 'bg-white text-black'
                                : 'bg-[#1D1D1F] text-white/70 hover:text-white border border-white/10'
                            }`}
                    >
                        {tab.label}
                        <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.key ? 'bg-black/20' : 'bg-white/10'
                            }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    placeholder="Tìm theo mã đơn hoặc tên khách..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#1D1D1F] border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
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
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Loại</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Tổng</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Trạng thái</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Ngày</th>
                            <th className="text-right text-white/50 text-sm font-medium px-5 py-4">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders.map((order) => (
                            <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="px-5 py-4">
                                    <span className="text-white font-medium">{order.id}</span>
                                </td>
                                <td className="px-5 py-4">
                                    <div>
                                        <p className="text-white">{order.customer}</p>
                                        <p className="text-white/50 text-sm">{order.email}</p>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <span className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-sm">
                                        {typeLabels[order.type]}
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-white font-medium">
                                    {order.total.toLocaleString('vi-VN')}đ
                                </td>
                                <td className="px-5 py-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                                        {statusLabels[order.status]}
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-white/50">
                                    {order.date}
                                </td>
                                <td className="px-5 py-4">
                                    <div className="flex items-center justify-end gap-2">
                                        <Link
                                            href={`/admin/orders/${order.id.replace('#', '')}`}
                                            className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:text-white text-sm transition-colors"
                                        >
                                            Chi tiết
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredOrders.length === 0 && (
                    <div className="p-12 text-center">
                        <p className="text-white/50">Không tìm thấy đơn hàng nào</p>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
