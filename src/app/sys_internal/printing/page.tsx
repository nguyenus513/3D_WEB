'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase/client';
// import type { Order } from '@/types/database'; // Don't use legacy type if it conflicts
import { addCsrfToRequest } from '@/lib/security/csrf-client';

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

export default function AdminPrintingPage() {
    // any for now to bypass strict legacy type checks during migration
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ pending: 0, producing: 0, completed: 0 });

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        const supabase = getSupabase();

        // Removed .eq('order_type', 'printing') as column is gone.
        // For now, fetching all orders. One could filter by 'producing' status if strictly needed.
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setOrders(data);

            // Calculate stats
            setStats({
                pending: data.filter((o: any) => o.status === 'pending').length,
                producing: data.filter((o: any) => o.status === 'producing' || o.status === 'processing').length,
                completed: data.filter((o: any) => o.status === 'delivered' || o.status === 'completed').length,
            });
        }
        setLoading(false);
    };

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        try {
            await fetch(`/api/admin/orders/${orderId}/update`, {
                method: 'PUT',
                headers: addCsrfToRequest({ 'Content-Type': 'application/json' }),
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
                    <h1 className="text-2xl font-bold text-white">Quản lý Đơn hàng (Printing)</h1>
                    <p className="text-white/50 mt-1">
                        {loading ? 'Đang tải...' : `${orders.length} đơn hàng`}
                    </p>
                </div>
                <button onClick={fetchOrders} className="px-4 py-2 bg-[#1D1D1F] border border-white/10 rounded-xl text-white/70 hover:text-white">
                    Làm mới
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Chờ thanh toán</p>
                    <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pending}</p>
                </div>
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Đang sản xuất</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">{stats.producing}</p>
                </div>
                <div className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm">Hoàn thành</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">{stats.completed}</p>
                </div>
            </div>

            {/* Orders table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 overflow-hidden"
            >
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-white/50">Đang tải...</p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-white/50">Chưa có đơn hàng nào</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Mã đơn</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Khách hàng</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Ngày tạo</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Giá</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Trạng thái</th>
                                    <th className="text-right text-white/50 text-sm font-medium px-5 py-4">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => {
                                    const shippingInfo = order.shipping_address_snapshot as any;
                                    return (
                                        <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="px-5 py-4">
                                                <Link href={`/sys_internal/printing/${order.id}`} className="text-white font-mono hover:text-blue-400">
                                                    {order.order_code}
                                                </Link>
                                            </td>
                                            <td className="px-5 py-4 text-white/70">
                                                {shippingInfo?.full_name || 'Khách'}
                                            </td>
                                            <td className="px-5 py-4 text-white/50">
                                                {new Date(order.created_at).toLocaleDateString('vi-VN')}
                                            </td>
                                            <td className="px-5 py-4 text-white">
                                                {Number(order.total_amount).toLocaleString('vi-VN')}đ
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-white/10 text-white/50'}`}>
                                                    {statusLabels[order.status] || order.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    {order.status === 'paid' && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(order.id, 'producing')}
                                                            className="px-3 py-1.5 bg-purple-500 text-white text-xs rounded-lg hover:bg-purple-600"
                                                        >
                                                            Bắt đầu SX
                                                        </button>
                                                    )}
                                                    {order.status === 'producing' && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(order.id, 'shipping')}
                                                            className="px-3 py-1.5 bg-cyan-500 text-white text-xs rounded-lg hover:bg-cyan-600"
                                                        >
                                                            Gửi hàng
                                                        </button>
                                                    )}
                                                    <Link
                                                        href={`/sys_internal/printing/${order.id}`}
                                                        className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:text-white text-sm"
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
