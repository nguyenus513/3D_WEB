'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Mock VIP customers
const vipCustomers = [
    { id: 1, name: 'Nguyễn Văn A', email: 'nguyenvana@gmail.com', phone: '0901234567', orders: 15, spent: 12500000, since: '03/2025', tier: 'gold' },
    { id: 2, name: 'Trần Thị B', email: 'tranthib@gmail.com', phone: '0912345678', orders: 10, spent: 8200000, since: '05/2025', tier: 'silver' },
    { id: 3, name: 'Lê Văn C', email: 'levanc@gmail.com', phone: '0923456789', orders: 8, spent: 6500000, since: '06/2025', tier: 'silver' },
    { id: 4, name: 'Phạm Thị D', email: 'phamthid@gmail.com', phone: '0934567890', orders: 20, spent: 18000000, since: '01/2025', tier: 'platinum' },
];

const tierColors: Record<string, string> = {
    silver: 'bg-gray-400/20 text-gray-300',
    gold: 'bg-yellow-500/20 text-yellow-400',
    platinum: 'bg-purple-400/20 text-purple-300',
};

const tierLabels: Record<string, string> = {
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
};

export default function AdminCustomersVipPage() {
    const [customers] = useState(vipCustomers);

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
                        <h1 className="text-2xl font-bold text-white">Khách hàng VIP</h1>
                        <p className="text-white/50 mt-1">Khách hàng thân thiết với nhiều đơn hàng</p>
                    </div>
                </div>
            </div>

            {/* VIP Tiers summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-3 h-3 rounded-full bg-purple-400" />
                        <span className="text-white font-medium">Platinum</span>
                    </div>
                    <p className="text-2xl font-bold text-white">2</p>
                    <p className="text-white/50 text-sm">≥ 15 đơn hàng</p>
                </div>
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <span className="text-white font-medium">Gold</span>
                    </div>
                    <p className="text-2xl font-bold text-white">5</p>
                    <p className="text-white/50 text-sm">≥ 10 đơn hàng</p>
                </div>
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-3 h-3 rounded-full bg-gray-400" />
                        <span className="text-white font-medium">Silver</span>
                    </div>
                    <p className="text-2xl font-bold text-white">12</p>
                    <p className="text-white/50 text-sm">≥ 5 đơn hàng</p>
                </div>
            </div>

            {/* VIP customers table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 overflow-hidden"
            >
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Khách hàng</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Tier</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Đơn hàng</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Tổng chi tiêu</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">VIP từ</th>
                            <th className="text-right text-white/50 text-sm font-medium px-5 py-4">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.map((customer) => (
                            <tr key={customer.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="px-5 py-4">
                                    <div>
                                        <p className="text-white font-medium">{customer.name}</p>
                                        <p className="text-white/50 text-sm">{customer.email}</p>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${tierColors[customer.tier]}`}>
                                        {tierLabels[customer.tier]}
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-white">{customer.orders}</td>
                                <td className="px-5 py-4 text-white">{customer.spent.toLocaleString('vi-VN')}đ</td>
                                <td className="px-5 py-4 text-white/70">{customer.since}</td>
                                <td className="px-5 py-4">
                                    <div className="flex items-center justify-end gap-2">
                                        <Link
                                            href={`/admin/customers/${customer.id}`}
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
            </motion.div>
        </div>
    );
}
