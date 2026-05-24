'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { formatOrderDate } from '@/lib/utils/orderStatus';
// import type { Order } from '@/types/database'; // Don't use legacy type if it conflicts

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    paid: 'bg-blue-500/20 text-blue-400',
    processing: 'bg-indigo-500/20 text-indigo-400',
    producing: 'bg-purple-500/20 text-purple-400', // printing -> producing
    shipping: 'bg-cyan-500/20 text-cyan-400',
    delivered: 'bg-green-500/20 text-green-400',
    completed: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    processing: 'Đang xử lý',
    producing: 'Đang sản xuất', // printing -> producing
    shipping: 'Đang giao hàng',
    delivered: 'Đã giao',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
};

// Production status for order items (sub-orders)
const productionStatusColors: Record<string, string> = {
    waiting: 'bg-orange-500/20 text-orange-400',
    printing: 'bg-purple-500/20 text-purple-400',
    done: 'bg-green-500/20 text-green-400',
    error: 'bg-red-500/20 text-red-400',
};

const productionStatusLabels: Record<string, string> = {
    waiting: 'Chờ in',
    printing: 'Đang in',
    done: 'Hoàn thành',
    error: 'Lỗi',
};

export default function AdminPrintingPage() {
    // any for now to bypass strict legacy type checks during migration
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ pending: 0, producing: 0, completed: 0 });

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/orders?type=printing', { cache: 'no-store' });
            const json = await res.json();
            const rows = (json.data?.orders || json.orders || []).filter((o: any) => ['printing', 'print_3d'].includes(o.order_type));
            setOrders(rows);
            setStats({
                pending: rows.filter((o: any) => o.status === 'pending').length,
                producing: rows.filter((o: any) => o.status === 'producing' || o.status === 'processing' || o.status === 'printing').length,
                completed: rows.filter((o: any) => o.status === 'delivered' || o.status === 'completed').length,
            });
        } catch (error) {
            console.error('[AdminPrinting] Fetch error:', error);
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

    // Update production status for individual order item
    // TODO: Re-enable after adding production_status column to order_items
    const handleUpdateProductionStatus = async (itemId: string, newStatus: string) => {
        console.warn('production_status column not available in current schema');
        // try {
        //     await supabase
        //         .from('order_items')
        //         .update({ production_status: newStatus })
        //         .eq('id', itemId);
        //     fetchOrders();
        // } catch (error) {
        //     console.error('Error updating production status:', error);
        // }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">Quản lý Đơn hàng (Printing)</h1>
                    <p className="text-[var(--text-secondary)] mt-1">
                        {loading ? 'Đang tải...' : `${orders.length} đơn hàng`}
                    </p>
                </div>
                <button onClick={fetchOrders} className="px-4 py-2 bg-[var(--material-panel)] border border-[var(--border-color)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    Làm mới
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[var(--material-panel)] rounded-2xl p-5 border border-[var(--border-color)]">
                    <p className="text-[var(--text-secondary)] text-sm">Chờ thanh toán</p>
                    <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pending}</p>
                </div>
                <div className="bg-[var(--material-panel)] rounded-2xl p-5 border border-[var(--border-color)]">
                    <p className="text-[var(--text-secondary)] text-sm">Đang sản xuất</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">{stats.producing}</p>
                </div>
                <div className="bg-[var(--material-panel)] rounded-2xl p-5 border border-[var(--border-color)]">
                    <p className="text-[var(--text-secondary)] text-sm">Hoàn thành</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">{stats.completed}</p>
                </div>
            </div>

            {/* Orders table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] overflow-hidden"
            >
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-[var(--text-secondary)]">Đang tải...</p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-[var(--text-secondary)]">Chưa có đơn hàng nào</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[var(--border-color)]">
                                    <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Mã đơn</th>
                                    <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Khách hàng</th>
                                    <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Ngày tạo</th>
                                    <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Giá</th>
                                    <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Trạng thái</th>
                                    <th className="text-right text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => {
                                    const shippingInfo = (order.shipping_address_snapshot || order.shipping_address) as any;
                                    return (
                                        <tr key={order.id} className="border-b border-[var(--border-color)] hover:bg-[var(--material-glass)] transition-colors">
                                            <td className="px-5 py-4">
                                                <Link href={`/sys_internal/printing/${order.id}`} className="text-[var(--text-primary)] font-mono hover:text-blue-400">
                                                    {/* Display cart_code if available, fallback to order_code */}
                                                    {order.cart_code || order.order_code}
                                                </Link>
                                                {/* Show legacy order_code in small text if cart_code exists */}
                                                {order.cart_code && (
                                                    <span className="block text-[var(--text-tertiary)] text-xs mt-0.5">
                                                        Code: {order.order_code}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-[var(--text-secondary)]">
                                                {shippingInfo?.full_name || 'Chưa có tên khách hàng'}
                                            </td>
                                            <td className="px-5 py-4 text-[var(--text-secondary)]">
                                                {formatOrderDate(order.created_at)}
                                            </td>
                                            <td className="px-5 py-4 text-[var(--text-primary)]">
                                                {Number(order.total_amount).toLocaleString('vi-VN')}đ
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-[var(--material-glass)] text-[var(--text-secondary)]'}`}>
                                                    {statusLabels[order.status] || order.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    {order.status === 'paid' && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(order.id, 'producing')}
                                                            className="px-3 py-1.5 bg-purple-500 text-[var(--text-primary)] text-xs rounded-lg hover:bg-purple-600"
                                                        >
                                                            Bắt đầu SX
                                                        </button>
                                                    )}
                                                    {order.status === 'producing' && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(order.id, 'shipping')}
                                                            className="px-3 py-1.5 bg-cyan-500 text-[var(--text-primary)] text-xs rounded-lg hover:bg-cyan-600"
                                                        >
                                                            Gửi hàng
                                                        </button>
                                                    )}
                                                    <Link
                                                        href={`/sys_internal/printing/${order.id}`}
                                                        className="px-3 py-1.5 rounded-lg bg-[var(--material-glass)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm"
                                                    >
                                                        Chi tiết
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

