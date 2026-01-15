'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Mock orders data
const orders = [
    { id: '#1001', date: '15/01/2026', items: [{ name: 'Custom Couple Figure', qty: 1 }, { name: 'Accessory Set', qty: 1 }], total: 850000, status: 'processing' },
    { id: '#0998', date: '10/01/2026', items: [{ name: 'Dragon Figure', qty: 1 }], total: 350000, status: 'completed' },
    { id: '#0995', date: '05/01/2026', items: [{ name: 'Printing Service', qty: 3 }], total: 1200000, status: 'completed' },
    { id: '#0990', date: '28/12/2025', items: [{ name: 'Anime Character', qty: 2 }], total: 560000, status: 'completed' },
];

const tabs = [
    { key: 'all', label: 'Tất cả' },
    { key: 'processing', label: 'Đang xử lý' },
    { key: 'completed', label: 'Hoàn thành' },
];

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    processing: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    completed: 'Hoàn thành',
};

export default function AccountOrdersPage() {
    const [activeTab, setActiveTab] = useState('all');

    const filteredOrders = activeTab === 'all'
        ? orders
        : orders.filter(order => order.status === activeTab);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Đơn hàng của tôi</h1>
                <p className="text-white/50 mt-1">Theo dõi và quản lý đơn hàng</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === tab.key
                                ? 'bg-white text-black'
                                : 'bg-[#1D1D1F] text-white/70 hover:text-white border border-white/10'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Orders list */}
            <div className="space-y-4">
                {filteredOrders.map((order, index) => (
                    <motion.div
                        key={order.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 overflow-hidden"
                    >
                        {/* Order header */}
                        <div className="p-5 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <span className="text-white font-semibold">{order.id}</span>
                                <span className="text-white/50 text-sm">{order.date}</span>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                                {statusLabels[order.status]}
                            </span>
                        </div>

                        {/* Order items */}
                        <div className="p-5">
                            <div className="space-y-3">
                                {order.items.map((item, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                                            <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-white">{item.name}</p>
                                            <p className="text-white/50 text-sm">x{item.qty}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Order footer */}
                        <div className="px-5 py-4 bg-white/5 flex items-center justify-between">
                            <div>
                                <span className="text-white/50 text-sm">Tổng cộng: </span>
                                <span className="text-white font-semibold">{order.total.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <Link
                                href={`/account/orders/${order.id.replace('#', '')}`}
                                className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
                            >
                                Xem chi tiết
                            </Link>
                        </div>
                    </motion.div>
                ))}

                {filteredOrders.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-white/50">Không có đơn hàng nào</p>
                    </div>
                )}
            </div>
        </div>
    );
}
