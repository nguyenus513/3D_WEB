'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

// Mock data
const stats = [
    {
        name: 'Doanh thu tháng', value: '45.2M', change: '+12%', icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        )
    },
    {
        name: 'Đơn hàng mới', value: '24', change: '+8', icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
        )
    },
    {
        name: 'Khách hàng', value: '156', change: '+23', icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        )
    },
    {
        name: 'Sản phẩm', value: '48', change: '+5', icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        )
    },
];

const recentOrders = [
    { id: '#1001', customer: 'Nguyễn Văn A', type: 'Custom', total: '850,000đ', status: 'pending' },
    { id: '#1002', customer: 'Trần Thị B', type: 'Sản phẩm', total: '350,000đ', status: 'processing' },
    { id: '#1003', customer: 'Lê Văn C', type: 'In 3D', total: '1,200,000đ', status: 'completed' },
    { id: '#1004', customer: 'Phạm Thị D', type: 'Custom', total: '650,000đ', status: 'pending' },
    { id: '#1005', customer: 'Hoàng Văn E', type: 'Sản phẩm', total: '280,000đ', status: 'completed' },
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

export default function AdminDashboard() {
    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-white/50 mt-1">Tổng quan hoạt động kinh doanh</p>
                </div>
                <Link
                    href="/admin/orders"
                    className="px-5 py-2.5 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
                >
                    Xem đơn hàng
                </Link>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                    <motion.div
                        key={stat.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10"
                    >
                        <div className="flex items-start justify-between">
                            <div className="p-2.5 rounded-xl bg-white/10 text-white/70">
                                {stat.icon}
                            </div>
                            <span className="text-green-400 text-sm font-medium">{stat.change}</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-2xl font-bold text-white">{stat.value}</p>
                            <p className="text-white/50 text-sm mt-1">{stat.name}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Revenue Breakdown */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
            >
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Doanh thu theo loại đơn</h2>
                        <p className="text-white/50 text-sm mt-1">Tháng này</p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-white">45.2M</p>
                        <p className="text-green-400 text-sm">+12% so với tháng trước</p>
                    </div>
                </div>
                <div className="space-y-4">
                    {/* Sản phẩm */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-blue-400" />
                                <span className="text-white">Sản phẩm</span>
                            </div>
                            <div className="text-right">
                                <span className="text-white font-medium">15.5M</span>
                                <span className="text-white/50 ml-2">34%</span>
                            </div>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full" style={{ width: '34%' }} />
                        </div>
                    </div>
                    {/* Custom */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-purple-400" />
                                <span className="text-white">Custom</span>
                            </div>
                            <div className="text-right">
                                <span className="text-white font-medium">22.1M</span>
                                <span className="text-white/50 ml-2">49%</span>
                            </div>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-400 rounded-full" style={{ width: '49%' }} />
                        </div>
                    </div>
                    {/* In 3D */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-green-400" />
                                <span className="text-white">In 3D</span>
                            </div>
                            <div className="text-right">
                                <span className="text-white font-medium">7.6M</span>
                                <span className="text-white/50 ml-2">17%</span>
                            </div>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-green-400 rounded-full" style={{ width: '17%' }} />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent orders */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="lg:col-span-2 bg-[#1D1D1F] rounded-2xl border border-white/10 overflow-hidden"
                >
                    <div className="p-5 border-b border-white/10 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Đơn hàng gần đây</h2>
                        <Link href="/admin/orders" className="text-sm text-white/50 hover:text-white transition-colors">
                            Xem tất cả →
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-3">Mã đơn</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-3">Khách hàng</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-3">Loại</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-3">Tổng</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-3">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map((order) => (
                                    <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="px-5 py-4 text-white font-medium">{order.id}</td>
                                        <td className="px-5 py-4 text-white/70">{order.customer}</td>
                                        <td className="px-5 py-4 text-white/70">{order.type}</td>
                                        <td className="px-5 py-4 text-white">{order.total}</td>
                                        <td className="px-5 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                                                {statusLabels[order.status]}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {/* Quick actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-5"
                >
                    <h2 className="text-lg font-semibold text-white mb-4">Thao tác nhanh</h2>
                    <div className="space-y-3">
                        <Link
                            href="/admin/products/new"
                            className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-white font-medium">Thêm sản phẩm</p>
                                <p className="text-white/50 text-sm">Tạo sản phẩm mới</p>
                            </div>
                        </Link>
                        <Link
                            href="/admin/orders?status=pending"
                            className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-white font-medium">Đơn chờ xử lý</p>
                                <p className="text-white/50 text-sm">5 đơn cần xác nhận</p>
                            </div>
                        </Link>
                        <Link
                            href="/admin/customers"
                            className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-white font-medium">Khách hàng mới</p>
                                <p className="text-white/50 text-sm">23 khách trong tuần</p>
                            </div>
                        </Link>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
