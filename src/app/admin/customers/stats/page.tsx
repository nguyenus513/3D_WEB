'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

// Mock stats data
const stats = {
    total: 156,
    new_this_month: 23,
    vip: 19,
    avg_order_value: 580000,
    retention_rate: 68,
};

const monthlyData = [
    { month: 'T8', customers: 12 },
    { month: 'T9', customers: 18 },
    { month: 'T10', customers: 15 },
    { month: 'T11', customers: 22 },
    { month: 'T12', customers: 28 },
    { month: 'T1', customers: 23 },
];

const topCustomers = [
    { name: 'Phạm Thị D', orders: 20, spent: 18000000 },
    { name: 'Nguyễn Văn A', orders: 15, spent: 12500000 },
    { name: 'Trần Thị B', orders: 10, spent: 8200000 },
    { name: 'Lê Văn C', orders: 8, spent: 6500000 },
    { name: 'Hoàng Văn E', orders: 7, spent: 5800000 },
];

const orderTypeDistribution = [
    { type: 'Custom', count: 65, percent: 42 },
    { type: 'Sản phẩm', count: 52, percent: 33 },
    { type: 'In 3D', count: 39, percent: 25 },
];

export default function AdminCustomersStatsPage() {
    const maxCustomers = Math.max(...monthlyData.map(d => d.customers));

    return (
        <div className="space-y-6">
            {/* Header */}
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
                    <h1 className="text-2xl font-bold text-white">Thống kê khách hàng</h1>
                    <p className="text-white/50 mt-1">Phân tích hành vi và xu hướng</p>
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Tổng khách hàng</p>
                    <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Mới tháng này</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">+{stats.new_this_month}</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Khách VIP</p>
                    <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.vip}</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Đơn TB/khách</p>
                    <p className="text-2xl font-bold text-white mt-1">{(stats.avg_order_value / 1000).toFixed(0)}K</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Tỷ lệ quay lại</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">{stats.retention_rate}%</p>
                </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                >
                    <h2 className="text-lg font-semibold text-white mb-6">Khách hàng mới theo tháng</h2>
                    <div className="flex items-end justify-between gap-4 h-48">
                        {monthlyData.map((data) => (
                            <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                                <div className="w-full bg-white/10 rounded-t-lg relative" style={{ height: `${(data.customers / maxCustomers) * 100}%` }}>
                                    <div className="absolute inset-0 bg-white/30 rounded-t-lg" />
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-white text-sm font-medium">{data.customers}</span>
                                </div>
                                <span className="text-white/50 text-sm">{data.month}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Order type distribution */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                >
                    <h2 className="text-lg font-semibold text-white mb-6">Phân bố loại đơn hàng</h2>
                    <div className="space-y-4">
                        {orderTypeDistribution.map((item, index) => (
                            <div key={item.type}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-white">{item.type}</span>
                                    <div className="text-right">
                                        <span className="text-white font-medium">{item.count}</span>
                                        <span className="text-white/50 ml-2">{item.percent}%</span>
                                    </div>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${item.percent}%` }}
                                        transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
                                        className={`h-full rounded-full ${index === 0 ? 'bg-purple-400' : index === 1 ? 'bg-blue-400' : 'bg-green-400'}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Top customers */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
            >
                <h2 className="text-lg font-semibold text-white mb-4">Top khách hàng</h2>
                <div className="space-y-3">
                    {topCustomers.map((customer, index) => (
                        <div key={customer.name} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors">
                            <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
                                {index + 1}
                            </span>
                            <div className="flex-1">
                                <p className="text-white font-medium">{customer.name}</p>
                                <p className="text-white/50 text-sm">{customer.orders} đơn hàng</p>
                            </div>
                            <p className="text-white font-medium">{customer.spent.toLocaleString('vi-VN')}đ</p>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
