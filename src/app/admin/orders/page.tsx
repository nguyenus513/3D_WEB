'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase/client';
import type { Order } from '@/types/database';

const statusTabs = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Chờ thanh toán' },
    { key: 'paid', label: 'Đã thanh toán' },
    { key: 'preparing', label: 'Đang chuẩn bị' },
    { key: 'shipped', label: 'Đã gửi hàng' },
    { key: 'delivered', label: 'Đã giao' },
];

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
    shipped: 'Đã gửi hàng',
    delivered: 'Đã giao',
    cancelled: 'Đã hủy',
    designing: 'Đang thiết kế',
    printing: 'Đang in',
};

const typeLabels: Record<string, string> = {
    ready_made: 'Sản phẩm',
    custom: 'Custom',
    printing: 'In 3D',
};

const typeColors: Record<string, string> = {
    ready_made: 'bg-blue-500/20 text-blue-400',
    custom: 'bg-purple-500/20 text-purple-400',
    printing: 'bg-green-500/20 text-green-400',
};

function OrdersContent() {
    const searchParams = useSearchParams();
    const typeFilter = searchParams.get('type') || 'all';
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeStatus, setActiveStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [confirming, setConfirming] = useState<string | null>(null);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('orders')
            .select('*, user:profiles(full_name, email)')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setOrders(data);
        }
        setLoading(false);
    };

    const handleConfirmPayment = async (orderId: string) => {
        setConfirming(orderId);
        const supabase = getSupabase();

        const { error } = await supabase
            .from('orders')
            .update({
                status: 'paid',
                deposit_paid: true,
                paid_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        if (!error) {
            setOrders(orders.map(o =>
                o.id === orderId
                    ? { ...o, status: 'paid' as const, deposit_paid: true }
                    : o
            ));
        }
        setConfirming(null);
    };

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        const supabase = getSupabase();

        const updateData: Record<string, unknown> = { status: newStatus };
        if (newStatus === 'shipped') updateData.shipped_at = new Date().toISOString();
        if (newStatus === 'delivered') updateData.delivered_at = new Date().toISOString();

        const { error } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId);

        if (!error) {
            setOrders(orders.map(o =>
                o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o
            ));
        }
    };

    // Filter orders
    const filteredOrders = orders.filter(order => {
        const matchesType = typeFilter === 'all' || order.order_type === typeFilter;
        const matchesStatus = activeStatus === 'all' || order.status === activeStatus;
        const matchesSearch = order.order_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.user as { full_name?: string })?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesType && matchesStatus && matchesSearch;
    });

    const getStatusCount = (status: string) => {
        if (status === 'all') return orders.length;
        return orders.filter(o => o.status === status).length;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Đơn hàng</h1>
                    <p className="text-white/50 mt-1">
                        {loading ? 'Đang tải...' : `${filteredOrders.length} đơn hàng`}
                    </p>
                </div>
                <button
                    onClick={fetchOrders}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#1D1D1F] border border-white/10 rounded-xl text-white/70 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Làm mới
                </button>
            </div>

            {/* Status Tabs */}
            <div className="flex gap-2 flex-wrap">
                {statusTabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveStatus(tab.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${activeStatus === tab.key
                                ? 'bg-white text-black'
                                : 'bg-[#1D1D1F] text-white/70 hover:text-white border border-white/10'
                            }`}
                    >
                        {tab.label}
                        <span className={`px-2 py-0.5 rounded-full text-xs ${activeStatus === tab.key ? 'bg-black/10' : 'bg-white/10'
                            }`}>
                            {getStatusCount(tab.key)}
                        </span>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    placeholder="Tìm theo mã đơn, tên khách..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#1D1D1F] border border-white/10 rounded-xl text-white placeholder:text-white/40"
                />
            </div>

            {/* Orders Table */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 overflow-hidden"
            >
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-white/50">Đang tải đơn hàng...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-white/50">Không có đơn hàng nào</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Mã đơn</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Khách hàng</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Loại</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Tổng tiền</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Trạng thái</th>
                                <th className="text-right text-white/50 text-sm font-medium px-5 py-4">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map((order) => (
                                <tr key={order.id} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="px-5 py-4">
                                        <Link href={`/admin/orders/${order.id}`} className="text-white font-mono hover:text-blue-400">
                                            {order.order_code}
                                        </Link>
                                        <p className="text-white/40 text-xs mt-1">
                                            {new Date(order.created_at).toLocaleDateString('vi-VN')}
                                        </p>
                                    </td>
                                    <td className="px-5 py-4">
                                        <p className="text-white">{(order.user as { full_name?: string })?.full_name || 'Khách'}</p>
                                        <p className="text-white/40 text-xs">{(order.user as { email?: string })?.email}</p>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[order.order_type]}`}>
                                            {typeLabels[order.order_type]}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <p className="text-white">{Number(order.total).toLocaleString('vi-VN')}đ</p>
                                        {order.status === 'pending' && (
                                            <p className="text-yellow-400 text-xs">
                                                Cọc: {Number(order.deposit_amount).toLocaleString('vi-VN')}đ
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                                            {statusLabels[order.status] || order.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            {order.status === 'pending' && (
                                                <button
                                                    onClick={() => handleConfirmPayment(order.id)}
                                                    disabled={confirming === order.id}
                                                    className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 disabled:opacity-50"
                                                >
                                                    {confirming === order.id ? '...' : 'Xác nhận CK'}
                                                </button>
                                            )}
                                            {order.status === 'paid' && (
                                                <button
                                                    onClick={() => handleUpdateStatus(order.id, 'preparing')}
                                                    className="px-3 py-1.5 bg-purple-500 text-white text-xs rounded-lg hover:bg-purple-600"
                                                >
                                                    Chuẩn bị
                                                </button>
                                            )}
                                            {order.status === 'preparing' && (
                                                <button
                                                    onClick={() => handleUpdateStatus(order.id, 'shipped')}
                                                    className="px-3 py-1.5 bg-cyan-500 text-white text-xs rounded-lg hover:bg-cyan-600"
                                                >
                                                    Đã gửi
                                                </button>
                                            )}
                                            <Link
                                                href={`/admin/orders/${order.id}`}
                                                className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </Link>
                                        </div>
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

export default function AdminOrdersPage() {
    return (
        <Suspense fallback={
            <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
            </div>
        }>
            <OrdersContent />
        </Suspense>
    );
}
