'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { getSupabase } from '@/lib/supabase/client';

interface OrderStats {
    total: number;
    processing: number;
    completed: number;
}

interface RecentOrder {
    id: string;
    order_code: string;
    created_at: string;
    total: number;
    status: string;
    item_count: number;
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
    shipped: 'Đang giao',
    delivered: 'Hoàn thành',
    cancelled: 'Đã hủy',
};

export default function AccountPage() {
    const { data: session, status } = useSession();
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [stats, setStats] = useState<OrderStats>({ total: 0, processing: 0, completed: 0 });
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.email) {
            fetchData();
        } else if (status === 'unauthenticated') {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, session]);

    const fetchData = async () => {
        if (!session?.user?.email) return;

        const supabase = getSupabase();

        // Get user from email
        const { data: user } = await supabase
            .from('profiles')
            .select('id, full_name, name')
            .eq('email', session.user.email)
            .single();

        if (!user) {
            setLoading(false);
            return;
        }

        // Set user name
        setUserName(user.full_name || user.name || session.user.email?.split('@')[0] || 'Bạn');

        interface Order {
            id: string;
            order_code: string;
            created_at: string;
            total: number;
            status: string;
            order_items: { count: number }[];
        }

        // Fetch orders for this user
        const { data: orders } = await supabase
            .from('orders')
            .select('id, order_code, created_at, total, status, order_items(count)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }) as { data: Order[] | null };

        if (orders) {
            // Calculate stats
            const total = orders.length;
            const processing = orders.filter((o: Order) => ['paid', 'preparing', 'shipped'].includes(o.status)).length;
            const completed = orders.filter((o: Order) => o.status === 'delivered').length;
            setStats({ total, processing, completed });

            // Get recent orders (top 3)
            const recent = orders.slice(0, 3).map((o: Order) => ({
                id: o.id,
                order_code: o.order_code,
                created_at: o.created_at,
                total: o.total,
                status: o.status,
                item_count: Array.isArray(o.order_items) ? o.order_items.length : 0,
            }));
            setRecentOrders(recent);
        }

        setLoading(false);
    };

    const statCards = [
        {
            name: 'Tổng đơn hàng', value: stats.total.toString(), icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
            )
        },
        {
            name: 'Đang xử lý', value: stats.processing.toString(), icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        {
            name: 'Hoàn thành', value: stats.completed.toString(), icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
    ];

    if (status === 'loading' || loading) {
        return (
            <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/50">Đang tải...</p>
            </div>
        );
    }

    const displayName = userName || session?.user?.name || session?.user?.email?.split('@')[0] || 'Bạn';

    return (
        <div className="space-y-6">
            {/* Welcome */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative backdrop-blur-xl rounded-2xl p-6 border border-white/10 overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(168, 85, 247, 0.08) 50%, rgba(255, 255, 255, 0.05) 100%)'
                }}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent pointer-events-none" />
                <h1 className="relative text-2xl font-bold text-white mb-2">
                    Xin chào, {displayName}!
                </h1>
                <p className="relative text-white/50">
                    Chào mừng bạn quay trở lại. Quản lý đơn hàng và thông tin cá nhân tại đây.
                </p>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {statCards.map((stat, index) => (
                    <motion.div
                        key={stat.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative backdrop-blur-xl rounded-2xl p-5 border border-white/10 overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.05) 50%, rgba(255, 255, 255, 0.03) 100%)'
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
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
                className="relative backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.05) 50%, rgba(255, 255, 255, 0.03) 100%)'
                }}
            >
                <div className="p-5 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Đơn hàng gần đây</h2>
                    <Link href="/account/orders" className="text-sm text-white/50 hover:text-white transition-colors">
                        Xem tất cả →
                    </Link>
                </div>
                <div className="divide-y divide-white/5">
                    {recentOrders.length > 0 ? (
                        recentOrders.map((order) => (
                            <Link
                                key={order.id}
                                href={`/account/orders/${order.id}`}
                                className="flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                                        <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">{order.order_code}</p>
                                        <p className="text-white/50 text-sm">
                                            {new Date(order.created_at).toLocaleDateString('vi-VN')} • {order.item_count} sản phẩm
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-white font-medium">{Number(order.total).toLocaleString('vi-VN')}đ</p>
                                    <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-500/20 text-gray-400'}`}>
                                        {statusLabels[order.status] || order.status}
                                    </span>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <div className="p-8 text-center">
                            <p className="text-white/50">Chưa có đơn hàng nào</p>
                            <Link href="/products" className="inline-block mt-4 px-6 py-2 bg-white text-black rounded-xl font-medium">
                                Mua sắm ngay
                            </Link>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Quick actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                    href="/products"
                    className="flex items-center gap-4 p-5 backdrop-blur-xl rounded-2xl border border-white/10 hover:bg-purple-500/10 transition-all"
                    style={{
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.05) 50%, rgba(255, 255, 255, 0.03) 100%)'
                    }}
                >
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="flex items-center gap-4 p-5 backdrop-blur-xl rounded-2xl border border-white/10 hover:bg-purple-500/10 transition-all"
                    style={{
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.05) 50%, rgba(255, 255, 255, 0.03) 100%)'
                    }}
                >
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
