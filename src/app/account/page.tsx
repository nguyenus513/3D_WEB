'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

// Mock data
const stats = [
    {
        name: 'Tổng đơn hàng', value: '12', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
        )
    },
    {
        name: 'Đang xử lý', value: '2', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        )
    },
    {
        name: 'Hoàn thành', value: '10', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        )
    },
];

const recentOrders = [
    { id: '#1001', date: '15/01/2026', items: 2, total: 850000, status: 'processing' },
    { id: '#0998', date: '10/01/2026', items: 1, total: 350000, status: 'completed' },
    { id: '#0995', date: '05/01/2026', items: 3, total: 1200000, status: 'completed' },
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

export default function AccountPage() {
    return (
        <div className="space-y-6">
            {/* Welcome */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1D1D1F] rounded-2xl p-6 border border-white/10"
            >
                <h1 className="text-2xl font-bold text-white mb-2">
                    Xin chào, Nguyễn Văn A! 👋
                </h1>
                <p className="text-white/50">
                    Chào mừng bạn quay trở lại. Quản lý đơn hàng và thông tin cá nhân tại đây.
                </p>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {stats.map((stat, index) => (
                    <motion.div
                        key={stat.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-white/10 text-white/70">
                                {stat.icon}
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{stat.value}</p>
                                <p className="text-white/50 text-sm">{stat.name}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Recent orders */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 overflow-hidden"
            >
                <div className="p-5 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Đơn hàng gần đây</h2>
                    <Link href="/account/orders" className="text-sm text-white/50 hover:text-white transition-colors">
                        Xem tất cả →
                    </Link>
                </div>
                <div className="divide-y divide-white/5">
                    {recentOrders.map((order) => (
                        <Link
                            key={order.id}
                            href={`/account/orders/${order.id.replace('#', '')}`}
                            className="flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-white font-medium">{order.id}</p>
                                    <p className="text-white/50 text-sm">{order.date} • {order.items} sản phẩm</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-white font-medium">{order.total.toLocaleString('vi-VN')}đ</p>
                                <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                                    {statusLabels[order.status]}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            </motion.div>

            {/* Quick actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                    href="/products"
                    className="flex items-center gap-4 p-5 bg-[#1D1D1F] rounded-2xl border border-white/10 hover:bg-white/5 transition-colors"
                >
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-white font-medium">Xem sản phẩm</p>
                        <p className="text-white/50 text-sm">Khám phá bộ sưu tập</p>
                    </div>
                </Link>
                <Link
                    href="/custom"
                    className="flex items-center gap-4 p-5 bg-[#1D1D1F] rounded-2xl border border-white/10 hover:bg-white/5 transition-colors"
                >
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-white font-medium">Đặt custom</p>
                        <p className="text-white/50 text-sm">Tạo mô hình riêng</p>
                    </div>
                </Link>
            </div>
        </div>
    );
}
