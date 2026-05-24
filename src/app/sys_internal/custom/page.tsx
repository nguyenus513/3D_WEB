'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Order } from '@/types/database';
import { formatOrderDate } from '@/lib/utils/orderStatus';

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    paid: 'bg-blue-500/20 text-blue-400',
    designing: 'bg-purple-500/20 text-purple-400',
    processing: 'bg-cyan-500/20 text-cyan-400', // Was review
    confirmed: 'bg-green-500/20 text-green-400',
    completed: 'bg-green-500/20 text-green-400',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    designing: 'Đang thiết kế',
    processing: 'Chờ duyệt mẫu', // Was review
    confirmed: 'Đã duyệt',
    preparing: 'Đang chuẩn bị',
    shipped: 'Đã gửi',
    delivered: 'Hoàn thành',
};

export default function AdminCustomPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ pending: 0, designing: 0, processing: 0, completed: 0 });

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/orders?type=custom', { cache: 'no-store' });
            const json = await res.json();
            const rows = (json.data?.orders || json.orders || []).filter((o: any) => o.order_type === 'custom');
            setOrders(rows);
            setStats({
                pending: rows.filter((o: Order) => o.status === 'pending').length,
                designing: rows.filter((o: Order) => o.status === 'designing' || o.status === 'paid').length,
                processing: rows.filter((o: Order) => o.status === 'processing').length,
                completed: rows.filter((o: Order) => o.status === 'delivered' || o.status === 'completed').length,
            });
        } catch (error) {
            console.error('[AdminCustom] Fetch error:', error);
        } finally {
            setLoading(false);
        }
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
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">Đơn Custom</h1>
                    <p className="text-[var(--text-secondary)] mt-1">
                        {loading ? 'Đang tải...' : `${orders.length} đơn hàng`}
                    </p>
                </div>
                <button onClick={fetchOrders} className="px-4 py-2 bg-[var(--material-panel)] border border-[var(--border-color)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    Làm mới
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-[var(--material-panel)] rounded-2xl p-5 border border-[var(--border-color)]">
                    <p className="text-[var(--text-secondary)] text-sm">Chờ thanh toán</p>
                    <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pending}</p>
                </div>
                <div className="bg-[var(--material-panel)] rounded-2xl p-5 border border-[var(--border-color)]">
                    <p className="text-[var(--text-secondary)] text-sm">Đang thiết kế</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">{stats.designing}</p>
                </div>
                <div className="bg-[var(--material-panel)] rounded-2xl p-5 border border-[var(--border-color)]">
                    <p className="text-[var(--text-secondary)] text-sm">Chờ duyệt</p>
                    <p className="text-2xl font-bold text-cyan-400 mt-1">{stats.processing}</p>
                </div>
                <div className="bg-[var(--material-panel)] rounded-2xl p-5 border border-[var(--border-color)]">
                    <p className="text-[var(--text-secondary)] text-sm">Hoàn thành</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">{stats.completed}</p>
                </div>
            </div>

            {/* Orders list */}
            {loading ? (
                <div className="p-12 text-center">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[var(--text-secondary)]">Đang tải...</p>
                </div>
            ) : orders.length === 0 ? (
                <div className="p-12 text-center bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)]">
                    <p className="text-[var(--text-secondary)]">Chưa có đơn custom nào</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map((order, index) => (
                        <motion.div
                            key={order.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-5"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex gap-4">
                                    {/* Photo placeholder */}
                                    <div className="w-16 h-16 rounded-xl bg-[var(--material-glass)] flex items-center justify-center">
                                        <svg className="w-6 h-6 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>

                                    {/* Info */}
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-[var(--text-primary)] font-semibold">{order.order_code}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                                                {statusLabels[order.status] || order.status}
                                            </span>
                                        </div>
                                        <p className="text-[var(--text-secondary)]">{(order as any).profiles?.full_name || (order as any).shipping_address_snapshot?.full_name || (order as any).shipping_address?.full_name || 'Chưa có tên khách hàng'}</p>
                                        <p className="text-[var(--text-secondary)] text-sm mt-1">
                                            {formatOrderDate(order.created_at)}
                                        </p>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="text-[var(--text-primary)] font-semibold">{Number(order.total_amount).toLocaleString('vi-VN')}đ</p>
                                    <div className="flex items-center gap-2 mt-3">
                                        {order.status === 'paid' && (
                                            <button
                                                onClick={() => handleUpdateStatus(order.id, 'designing')}
                                                className="px-3 py-1.5 bg-purple-500 text-[var(--text-primary)] text-xs rounded-lg hover:bg-purple-600"
                                            >
                                                Bắt đầu TK
                                            </button>
                                        )}
                                        {order.status === 'designing' && (
                                            <button
                                                onClick={() => handleUpdateStatus(order.id, 'processing')}
                                                className="px-3 py-1.5 bg-cyan-500 text-[var(--text-primary)] text-xs rounded-lg hover:bg-cyan-600"
                                            >
                                                Gửi duyệt
                                            </button>
                                        )}
                                        <Link
                                            href={`/sys_internal/custom/${order.id}`}
                                            className="px-4 py-2 rounded-xl bg-[var(--material-glass)] text-[var(--text-primary)] text-sm hover:bg-[var(--material-glass)]"
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
