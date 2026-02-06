'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';

interface OrderItem {
    name: string;
    quantity: number;
    total_price: number;
}

interface Order {
    id: string;
    order_code: string;
    created_at: string;
    total: number;
    status: string;
    order_items: OrderItem[];
}

const tabs = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Chờ thanh toán' },
    { key: 'pending_confirmation', label: 'Chờ xác nhận' },
    { key: 'processing', label: 'Đang xử lý' },
    { key: 'completed', label: 'Hoàn thành' },
];

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    pending_confirmation: 'bg-orange-500/20 text-orange-400',
    confirmed: 'bg-green-500/20 text-green-400',
    processing: 'bg-blue-500/20 text-blue-400',
    designing: 'bg-purple-500/20 text-purple-400',
    review: 'bg-orange-500/20 text-orange-400',
    revising: 'bg-pink-500/20 text-pink-400',
    approved: 'bg-cyan-500/20 text-cyan-400',
    production_pending: 'bg-indigo-500/20 text-indigo-400',
    producing: 'bg-indigo-500/20 text-indigo-400',
    printing: 'bg-violet-500/20 text-violet-400',
    shipping: 'bg-amber-500/20 text-amber-400',
    delivered: 'bg-emerald-500/20 text-emerald-400',
    cancelled: 'bg-red-500/20 text-red-400',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ thanh toán',
    pending_confirmation: 'Chờ xác nhận giao dịch',
    confirmed: 'Đã xác nhận TT',
    processing: 'Đang xử lý',
    designing: 'Đang thiết kế',
    review: 'Chờ xác nhận',
    revising: 'Đang chỉnh sửa',
    approved: 'Đã xác nhận',
    production_pending: 'Chờ sản xuất',
    producing: 'Đang sản xuất',
    printing: 'Đang in',
    shipping: 'Đang giao hàng',
    delivered: 'Đã giao',
    cancelled: 'Đã hủy',
};

export default function AccountOrdersPage() {
    const { data: session, status } = useSession();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.email) {
            fetchOrders();
        } else if (status === 'unauthenticated') {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, session]);

    const fetchOrders = async () => {
        if (!session?.user?.email) return;

        try {
            // Call unified API that fetches from both order_child and orders tables
            const res = await fetch('/api/orders/my-orders');
            if (res.ok) {
                const response = await res.json();
                // API returns { success: true, data: [...], meta: {...} }
                const ordersData = Array.isArray(response.data) ? response.data : [];
                setOrders(ordersData);
            } else {
                console.error('Failed to fetch orders:', res.statusText);
            }
        } catch (e) {
            console.error('Failed to fetch orders', e);
        }
        setLoading(false);
    };

    const filteredOrders = activeTab === 'all'
        ? orders
        : activeTab === 'processing'
            ? orders.filter(o => ['confirmed', 'processing', 'designing', 'review', 'revising', 'approved', 'production_pending', 'producing', 'printing', 'shipping'].includes(o.status))
            : activeTab === 'completed'
                ? orders.filter(o => o.status === 'delivered')
                : orders.filter(o => o.status === activeTab);

    if (status === 'loading' || loading) {
        return (
            <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/50">Đang tải đơn hàng...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Đơn hàng của tôi</h1>
                    <p className="text-white/50 mt-1">
                        {orders.length} đơn hàng
                    </p>
                </div>
                <button onClick={fetchOrders} className="px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl text-white/70 hover:text-white">
                    Làm mới
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === tab.key
                            ? 'bg-white text-black'
                            : 'bg-white/5 backdrop-blur-xl text-white/70 hover:text-white border border-white/10'
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
                        transition={{ delay: index * 0.05 }}
                        className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden"
                    >
                        {/* Order header */}
                        <div className="p-5 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <span className="text-white font-semibold">{order.order_code}</span>
                                <span className="text-white/50 text-sm">
                                    {new Date(order.created_at).toLocaleDateString('vi-VN')}
                                </span>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                                {statusLabels[order.status] || order.status}
                            </span>
                        </div>

                        {/* Order items */}
                        <div className="p-5">
                            <div className="space-y-3">
                                {order.order_items?.slice(0, 3).map((item, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                                            <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-white">{item.name}</p>
                                            <p className="text-white/50 text-sm">x{item.quantity}</p>
                                        </div>
                                        <p className="text-white">{Number(item.total_price).toLocaleString('vi-VN')}đ</p>
                                    </div>
                                ))}
                                {(order.order_items?.length || 0) > 3 && (
                                    <p className="text-white/50 text-sm">+{(order.order_items?.length || 0) - 3} sản phẩm khác</p>
                                )}
                            </div>
                        </div>

                        {/* Order footer */}
                        <div className="px-5 py-4 bg-white/5 flex items-center justify-between">
                            <div>
                                <span className="text-white/50 text-sm">Tổng cộng: </span>
                                <span className="text-white font-semibold">{Number(order.total).toLocaleString('vi-VN')}đ</span>
                            </div>
                            <Link
                                href={`/account/orders/${order.id}`}
                                className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20"
                            >
                                Xem chi tiết
                            </Link>
                        </div>
                    </motion.div>
                ))}

                {filteredOrders.length === 0 && (
                    <div className="text-center py-12 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
                        <p className="text-white/50">Không có đơn hàng nào</p>
                        <Link href="/products" className="inline-block mt-4 px-6 py-2 bg-white text-black rounded-xl font-medium">
                            Mua sắm ngay
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
