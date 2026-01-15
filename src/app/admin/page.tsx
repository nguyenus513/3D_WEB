'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase/client';

interface DashboardStats {
    revenue: number;
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
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        revenue: 0,
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
        const supabase = getSupabase();

        // Fetch all data in parallel
        const [ordersRes, customersRes, productsRes] = await Promise.all([
            supabase.from('orders').select('*, user:profiles(full_name)'),
            supabase.from('profiles').select('id').eq('role', 'customer'),
            supabase.from('products').select('id'),
        ]);

        const orders = ordersRes.data || [];
        const customers = customersRes.data || [];
        const products = productsRes.data || [];

        // Calculate stats
        const totalRevenue = orders
            .filter((o: { status: string }) => o.status === 'delivered')
            .reduce((sum: number, o: { total: number }) => sum + Number(o.total), 0);

        const pendingOrders = orders.filter((o: { status: string }) => o.status === 'pending').length;

        setStats({
            revenue: totalRevenue,
            orders: orders.length,
            customers: customers.length,
            products: products.length,
            pendingOrders,
        });

        // Recent orders
        const recent = orders.slice(0, 5).map((o: { id: string; order_code: string; order_type: string; total: number; status: string; created_at: string; user?: { full_name?: string } }) => ({
            id: o.id,
            order_code: o.order_code,
            order_type: o.order_type,
            total: Number(o.total),
            status: o.status,
            customer_name: (o.user as { full_name?: string })?.full_name,
            created_at: o.created_at,
        }));
        setRecentOrders(recent);

        setLoading(false);
    };

    const formatRevenue = (value: number) => {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + 'M';
        }
        if (value >= 1000) {
            return (value / 1000).toFixed(0) + 'K';
        }
        return value.toString();
    };

    const statCards = [
        {
            name: 'Doanh thu',
            value: formatRevenue(stats.revenue),
            suffix: 'đ',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            color: 'text-green-400',
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
        },
        {
            name: 'Khách hàng',
            value: stats.customers.toString(),
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
            color: 'text-purple-400',
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
                        href="/admin/orders"
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
                        className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10"
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
                    <Link href="/admin/orders" className="text-sm text-white/50 hover:text-white">
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
                                <tr key={order.id} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="px-5 py-4">
                                        <Link href={`/admin/orders/${order.id}`} className="text-white font-mono hover:text-blue-400">
                                            {order.order_code}
                                        </Link>
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

            {/* Quick actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/admin/products/new" className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-white font-medium">Thêm sản phẩm</p>
                            <p className="text-white/50 text-sm">Tạo sản phẩm mới</p>
                        </div>
                    </div>
                </Link>
                <Link href="/admin/orders?status=pending" className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-white font-medium">Đơn chờ xử lý</p>
                            <p className="text-white/50 text-sm">{stats.pendingOrders} đơn cần xác nhận</p>
                        </div>
                    </div>
                </Link>
                <Link href="/admin/customers" className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-white font-medium">Khách hàng</p>
                            <p className="text-white/50 text-sm">{stats.customers} khách hàng</p>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}
