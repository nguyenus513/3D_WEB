'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { ShoppingBag, Clock, CheckCircle, Box, PenLine } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatOrderDate } from '@/lib/utils/orderStatus';

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

        let user: any = null;
        try {
            const res = await fetch('/api/profile');
            if (res.ok) {
                const response = await res.json();
                user = response.data || response;
            }
        } catch (e) {
            console.error('Failed to fetch profile', e);
        }

        if (!user) {
            setLoading(false);
            return;
        }

        setUserName(user.full_name || session.user.email?.split('@')[0] || 'Bạn');

        try {
            const ordersRes = await fetch('/api/orders/my-orders');
            if (ordersRes.ok) {
                const response = await ordersRes.json();
                const orders = Array.isArray(response.data) ? response.data : [];

                const total = orders.length;
                const processing = orders.filter((o: any) => ['paid', 'preparing', 'shipped', 'confirmed', 'processing', 'designing', 'review', 'revising', 'approved', 'producing', 'printing', 'shipping'].includes(o.status)).length;
                const completed = orders.filter((o: any) => o.status === 'delivered').length;
                setStats({ total, processing, completed });

                const recent = orders.slice(0, 3).map((o: any) => ({
                    id: o.id,
                    order_code: o.order_code,
                    created_at: o.created_at,
                    total: o.total_amount || 0,
                    status: o.status,
                    item_count: Array.isArray(o.order_items) ? o.order_items.length : 1,
                }));
                setRecentOrders(recent);
            }
        } catch (e) {
            console.error('Failed to fetch orders', e);
        }

        setLoading(false);
    };

    const statCards = [
        {
            name: 'Tổng đơn hàng', value: stats.total.toString(), icon: (
                <ShoppingBag size={20} strokeWidth={1.5} />
            )
        },
        {
            name: 'Đang xử lý', value: stats.processing.toString(), icon: (
                <Clock size={20} strokeWidth={1.5} />
            )
        },
        {
            name: 'Hoàn thành', value: stats.completed.toString(), icon: (
                <CheckCircle size={20} strokeWidth={1.5} />
            )
        },
    ];

    if (status === 'loading' || loading) {
        return (
            <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[var(--text-tertiary)]">Đang tải...</p>
            </div>
        );
    }

    const displayName = userName || session?.user?.name || session?.user?.email?.split('@')[0] || 'Bạn';

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <Card className="bg-[var(--material-glass)] backdrop-blur-xl rounded-2xl border-[var(--border-color)]">
                    <CardContent className="p-6">
                        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                            Xin chào, {displayName}!
                        </h1>
                        <p className="text-[var(--text-tertiary)]">
                            Chào mừng bạn quay trở lại. Quản lý đơn hàng và thông tin cá nhân tại đây.
                        </p>
                    </CardContent>
                </Card>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {statCards.map((stat, index) => (
                    <motion.div
                        key={stat.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <Card className="bg-[var(--material-glass)] backdrop-blur-xl rounded-2xl border-[var(--border-color)]">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-[var(--material-glass)] text-[var(--text-secondary)]">
                                        {stat.icon}
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-[var(--text-primary)]">{stat.value}</p>
                                        <p className="text-[var(--text-tertiary)] text-sm">{stat.name}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <Card className="bg-[var(--material-glass)] backdrop-blur-xl rounded-2xl border-[var(--border-color)] overflow-hidden">
                    <CardHeader className="p-5 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-lg font-semibold text-[var(--text-primary)]">Đơn hàng gần đây</CardTitle>
                        <Link href="/account/orders" className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                            Xem tất cả →
                        </Link>
                    </CardHeader>
                    <Separator className="bg-[var(--border-color)]" />
                    <div className="divide-y divide-[var(--border-color)]/50">
                        {recentOrders.length > 0 ? (
                            recentOrders.map((order) => (
                                <Link
                                    key={order.id}
                                    href={`/account/orders/${order.id}`}
                                    className="flex items-center justify-between p-5 hover:bg-[var(--material-glass)] transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-[var(--material-glass)] flex items-center justify-center">
                                            <svg className="w-6 h-6 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-[var(--text-primary)] font-medium font-mono tracking-wider">{order.order_code}</p>
                                            <p className="text-[var(--text-tertiary)] text-sm">
                                                {formatOrderDate(order.created_at)} • {order.item_count} sản phẩm
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[var(--text-primary)] font-medium">{Number(order.total).toLocaleString('vi-VN')}đ</p>
                                        <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-500/20 text-gray-400'}`}>
                                            {statusLabels[order.status] || order.status}
                                        </span>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                <p className="text-[var(--text-tertiary)]">Chưa có đơn hàng nào</p>
                                <Button asChild className="mt-4 rounded-xl">
                                    <Link href="/products">Mua sắm ngay</Link>
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link href="/products">
                    <Card className="bg-[var(--material-panel)] rounded-2xl border-[var(--border-color)] hover:bg-[var(--material-glass)] transition-colors cursor-pointer">
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className="w-12 h-12 rounded-xl bg-[var(--material-glass)] flex items-center justify-center">
                                <Box size={24} className="text-[var(--text-secondary)]" strokeWidth={1.5} />
                            </div>
                            <div>
                                <p className="text-[var(--text-primary)] font-medium">Xem sản phẩm</p>
                                <p className="text-[var(--text-tertiary)] text-sm">Khám phá bộ sưu tập</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/custom">
                    <Card className="bg-[var(--material-panel)] rounded-2xl border-[var(--border-color)] hover:bg-[var(--material-glass)] transition-colors cursor-pointer">
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className="w-12 h-12 rounded-xl bg-[var(--material-glass)] flex items-center justify-center">
                                <PenLine size={24} className="text-[var(--text-secondary)]" strokeWidth={1.5} />
                            </div>
                            <div>
                                <p className="text-[var(--text-primary)] font-medium">Đặt custom</p>
                                <p className="text-[var(--text-tertiary)] text-sm">Tạo mô hình riêng</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    );
}
