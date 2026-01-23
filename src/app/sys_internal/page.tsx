'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase/client';
import { useAdminPath } from '@/hooks/useAdminPath';

interface DashboardStats {
    revenue: number;
    currentMonth: number;
    orders: number;
    customers: number;
    products: number;
    pendingOrders: number;
}

interface RecentOrder {
    id: string;
    order_code: string;
    order_type: string;
    total: number;
    status: string;
    customer_name?: string;
    created_at: string;
}

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    paid: 'bg-blue-500/20 text-blue-400',
    preparing: 'bg-purple-500/20 text-purple-400',
    shipped: 'bg-cyan-500/20 text-cyan-400',
    delivered: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    preparing: 'Đang chuẩn bị',
    shipped: 'Đã gửi',
    delivered: 'Hoàn thành',
    cancelled: 'Đã hủy',
};

const typeLabels: Record<string, string> = {
    ready_made: 'Sản phẩm',
    custom: 'Custom',
    printing: 'In 3D',
};

export default function AdminDashboard() {
    const { adminRoot } = useAdminPath();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        revenue: 0,
        currentMonth: new Date().getMonth() + 1,
        orders: 0,
        customers: 0,
        products: 0,
        pendingOrders: 0,
    });
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const response = await fetch('/api/admin/stats');
            const data = await response.json();

            if (data.error) {
                console.error('Error fetching dashboard data:', data.error);
                setLoading(false);
                return;
            }

            setStats(data.stats || {
                revenue: 0,
                currentMonth: new Date().getMonth() + 1,
                orders: 0,
                customers: 0,
                products: 0,
                pendingOrders: 0,
            });
            setRecentOrders(data.recentOrders || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        {
            name: `Thu nhập T${stats.currentMonth || new Date().getMonth() + 1}`,
            value: stats.revenue.toLocaleString('vi-VN'),
            suffix: 'đ',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            color: 'text-green-400',
            href: `${adminRoot}/revenue`,
        },
        {
            name: 'Đơn hàng',
            value: stats.orders.toString(),
            pending: stats.pendingOrders,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
            ),
            color: 'text-blue-400',
            href: `${adminRoot}/orders`,
        },
        {
            name: 'Khách hàng',
            value: stats.customers.toString(),
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            ),
            color: 'text-purple-400',
            href: `${adminRoot}/customers`,
        },
        {
            name: 'Sản phẩm',
            value: stats.products.toString(),
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            ),
            color: 'text-cyan-400',
            href: `${adminRoot}/products`,
        },
    ];

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-white/50 mt-1">
                        {loading ? 'Đang tải...' : 'Tổng quan hoạt động kinh doanh'}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchDashboardData}
                        className="px-4 py-2 bg-[#1D1D1F] border border-white/10 rounded-xl text-white/70 hover:text-white"
                    >
                        Làm mới
                    </button>
                    <Link
                        href={`${adminRoot}/orders`}
                        className="px-5 py-2.5 bg-white text-black rounded-xl font-medium hover:bg-white/90"
                    >
                        Xem đơn hàng
                    </Link>
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat, index) => (
                    <motion.div
                        key={stat.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <Link
                            href={stat.href}
                            className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10 block hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center ${stat.color}`}>
                                    {stat.icon}
                                </div>
                                {stat.pending !== undefined && stat.pending > 0 && (
                                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                                        {stat.pending} chờ xử lý
                                    </span>
                                )}
                            </div>
                            <p className="text-white/50 text-sm">{stat.name}</p>
                            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>
                                {loading ? '...' : stat.value}{stat.suffix || ''}
                            </p>
                        </Link>
                    </motion.div>
                ))}
            </div>

            {/* Recent orders */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 overflow-hidden"
            >
                <div className="p-5 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Đơn hàng gần đây</h2>
                    <Link href={`${adminRoot}/orders`} className="text-sm text-white/50 hover:text-white">
                        Xem tất cả →
                    </Link>
                </div>

                {loading ? (
                    <div className="p-12 text-center">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
                    </div>
                ) : recentOrders.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-white/50">Chưa có đơn hàng nào</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-3">Mã đơn</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-3">Khách</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-3">Loại</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-3">Tổng</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-3">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentOrders.map((order) => (
                                <tr
                                    key={order.id}
                                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                                    onClick={() => window.location.href = `${adminRoot}/orders/${order.id}`}
                                >
                                    <td className="px-5 py-4">
                                        <span className="text-white font-mono hover:text-blue-400 transition-colors">
                                            {order.order_code}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-white/70">{order.customer_name || 'Khách'}</td>
                                    <td className="px-5 py-4 text-white/50">{typeLabels[order.order_type] || order.order_type}</td>
                                    <td className="px-5 py-4 text-white">{order.total.toLocaleString('vi-VN')}đ</td>
                                    <td className="px-5 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                                            {statusLabels[order.status] || order.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </motion.div>


        </div>
    );
}
