'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase/client';
import type { Order } from '@/types/database';

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    paid: 'bg-blue-500/20 text-blue-400',
    designing: 'bg-purple-500/20 text-purple-400',
    review: 'bg-cyan-500/20 text-cyan-400',
    confirmed: 'bg-green-500/20 text-green-400',
    completed: 'bg-green-500/20 text-green-400',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    designing: 'Đang thiết kế',
    review: 'Chờ duyệt mẫu',
    confirmed: 'Đã duyệt',
    preparing: 'Đang chuẩn bị',
    shipped: 'Đã gửi',
    delivered: 'Hoàn thành',
};

export default function AdminCustomPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ pending: 0, designing: 0, review: 0, completed: 0 });

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('order_type', 'custom')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setOrders(data);
            setStats({
                pending: data.filter((o: Order) => o.status === 'pending').length,
                designing: data.filter((o: Order) => o.status === 'designing' || o.status === 'paid').length,
                review: data.filter((o: Order) => o.status === 'review').length,
                completed: data.filter((o: Order) => o.status === 'delivered').length,
            });
        }
        setLoading(false);
    };

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        try {
            await fetch(`/api/admin/orders/${orderId}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            fetchOrders();
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Đơn Custom</h1>
                    <p className="text-white/50 mt-1">
                        {loading ? 'Đang tải...' : `${orders.length} đơn hàng`}
                    </p>
                </div>
                <button onClick={fetchOrders} className="px-4 py-2 bg-[#1D1D1F] border border-white/10 rounded-xl text-white/70 hover:text-white">
                    Làm mới
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Chờ thanh toán</p>
                    <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pending}</p>
                </div>
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Đang thiết kế</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">{stats.designing}</p>
                </div>
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Chờ duyệt</p>
                    <p className="text-2xl font-bold text-cyan-400 mt-1">{stats.review}</p>
                </div>
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Hoàn thành</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">{stats.completed}</p>
                </div>
            </div>

            {/* Orders list */}
            {loading ? (
                <div className="p-12 text-center">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white/50">Đang tải...</p>
                </div>
            ) : orders.length === 0 ? (
                <div className="p-12 text-center bg-[#1D1D1F] rounded-2xl border border-white/10">
                    <p className="text-white/50">Chưa có đơn custom nào</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map((order, index) => (
                        <motion.div
                            key={order.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-5"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex gap-4">
                                    {/* Photo placeholder */}
                                    <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center">
                                        <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>

                                    {/* Info */}
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-white font-semibold">{order.order_code}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                                                {statusLabels[order.status] || order.status}
                                            </span>
                                        </div>
                                        <p className="text-white/70">{order.shipping_address?.full_name || 'Khách'}</p>
                                        <p className="text-white/50 text-sm mt-1">
                                            {new Date(order.created_at).toLocaleDateString('vi-VN')}
                                        </p>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="text-white font-semibold">{Number(order.total).toLocaleString('vi-VN')}đ</p>
                                    <div className="flex items-center gap-2 mt-3">
                                        {order.status === 'paid' && (
                                            <button
                                                onClick={() => handleUpdateStatus(order.id, 'designing')}
                                                className="px-3 py-1.5 bg-purple-500 text-white text-xs rounded-lg hover:bg-purple-600"
                                            >
                                                Bắt đầu TK
                                            </button>
                                        )}
                                        {order.status === 'designing' && (
                                            <button
                                                onClick={() => handleUpdateStatus(order.id, 'review')}
                                                className="px-3 py-1.5 bg-cyan-500 text-white text-xs rounded-lg hover:bg-cyan-600"
                                            >
                                                Gửi duyệt
                                            </button>
                                        )}
                                        <Link
                                            href={`/sys_internal/custom/${order.id}`}
                                            className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20"
                                        >
                                            Chi tiết
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
