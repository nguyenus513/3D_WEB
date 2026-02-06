'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Order } from '@/types/database';

const statusTabs = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending_payment', label: 'Chờ thanh toán' },
    { key: 'pending_confirmation', label: 'Chờ xác nhận TT' },
    { key: 'confirmed', label: 'Đã xác nhận' },
    { key: 'processing', label: 'Đang xử lý' },
    { key: 'designing', label: 'Đang thiết kế' },
    { key: 'printing', label: 'Đang in' },
    { key: 'shipping', label: 'Đang giao hàng' },
    { key: 'delivered', label: 'Đã giao' },
    { key: 'cancelled', label: 'Đã hủy' },
];

const statusLabels: Record<string, string> = {
    pending: 'Chờ thanh toán',
    pending_confirmation: 'Chờ xác nhận TT',
    confirmed: 'Đã xác nhận',
    paid: 'Đã thanh toán',
    processing: 'Đang xử lý',
    producing: 'Đang sản xuất',
    shipping: 'Đang giao hàng',
    delivered: 'Đã giao',
    cancelled: 'Đã hủy',
    refunded: 'Đã hoàn tiền',
    designing: 'Đang thiết kế',
    review: 'Chờ duyệt demo',
    revising: 'Đang chỉnh sửa',
    approved: 'Đã duyệt',
    production_pending: 'Chờ sản xuất',
    printing: 'Đang in',
    completed: 'Hoàn thành',
    expired: 'Hết hạn',
    payment_failed: 'Thanh toán thất bại',
};

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    pending_confirmation: 'bg-orange-500/20 text-orange-400',
    confirmed: 'bg-green-500/20 text-green-400',
    paid: 'bg-blue-500/20 text-blue-400',
    processing: 'bg-indigo-500/20 text-indigo-400',
    producing: 'bg-purple-500/20 text-purple-400',
    shipping: 'bg-cyan-500/20 text-cyan-400',
    delivered: 'bg-green-500/20 text-green-400',
    completed: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
    refunded: 'bg-red-500/20 text-red-400',
    designing: 'bg-pink-500/20 text-pink-400',
    review: 'bg-orange-500/20 text-orange-400',
    revising: 'bg-pink-500/20 text-pink-400',
    approved: 'bg-cyan-500/20 text-cyan-400',
    production_pending: 'bg-indigo-500/20 text-indigo-400',
    printing: 'bg-violet-500/20 text-violet-400',
    expired: 'bg-gray-500/20 text-gray-400',
    payment_failed: 'bg-red-500/20 text-red-400',
};

interface OrderListProps {
    orderType?: string | 'all';
    title: string;
    subtitle?: string;
}

interface OrderWithProfile extends Order {
    profiles?: {
        full_name?: string;
        email?: string;
        phone?: string;
        instagram_username?: string;
    } | null;
}

export function OrderList({ orderType = 'all', title, subtitle }: OrderListProps) {
    const pathname = usePathname();
    const [orders, setOrders] = useState<OrderWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeStatus, setActiveStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [confirming, setConfirming] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState<{ day?: string; month?: string; year?: string }>({
        day: '',
        month: '',
        year: '',
    });

    const pathParts = pathname.split('/');
    const adminRoot = pathParts.length >= 2 && pathParts[1].length >= 40 ? `/${pathParts[1]}` : '/sys_internal';

    useEffect(() => {
        fetchOrders();
    }, [orderType]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/admin/orders?type=${orderType}`);
            const json = await response.json();

            if (!json.success || json.error) {
                console.error('Error fetching orders:', json.error || 'Unknown error');
                setOrders([]);
            } else {
                setOrders(json.data?.orders || []);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmPayment = async (orderId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        setConfirming(orderId);
        const isReadyMade = order.order_type === 'ready_made';
        const paymentStatus = isReadyMade ? 'paid' : 'deposit_paid';

        try {
            const res = await fetch(`/api/admin/orders/${orderId}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payment_status: paymentStatus,
                    deposit_paid: true,
                    status: 'confirmed',
                    paid_at: new Date().toISOString(),
                }),
            });
            const json = await res.json();

            if (json.success) {
                setOrders(orders.map(o =>
                    o.id === orderId
                        ? { ...o, status: 'confirmed' as any, payment_status: paymentStatus as any, deposit_paid: true }
                        : o
                ));
            } else {
                console.error('Error confirming payment:', json.error);
            }
        } catch (error) {
            console.error('Error confirming payment:', error);
        }
        setConfirming(null);
    };

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            const json = await res.json();

            if (json.success) {
                setOrders(orders.map(o =>
                    o.id === orderId ? { ...o, status: newStatus as any } : o
                ));
            } else {
                console.error('Error updating status:', json.error);
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const matchesStatus = (order: OrderWithProfile) => {
        if (activeStatus === 'all') return true;
        if (activeStatus === 'pending_payment') {
            return order.payment_status === 'pending' && order.status === 'pending';
        }
        if (activeStatus === 'pending_confirmation') {
            return order.status === 'pending_confirmation';
        }
        return order.status === activeStatus;
    };

    const filteredOrders = orders.filter(order => {
        const matchesStatusFilter = matchesStatus(order);
        const profile = order.profiles as { full_name?: string; email?: string } | null;

        const shippingName = (order.shipping_address_snapshot as any)?.full_name;
        const shippingPhone = (order.shipping_address_snapshot as any)?.phone;

        const matchesSearch = order.order_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (shippingName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (order.user_id && order.user_id.toLowerCase().includes(searchTerm.toLowerCase()));

        const orderDate = new Date(order.created_at);
        const matchesDay = !dateFilter.day || orderDate.getDate() === parseInt(dateFilter.day);
        const matchesMonth = !dateFilter.month || (orderDate.getMonth() + 1) === parseInt(dateFilter.month);
        const matchesYear = !dateFilter.year || orderDate.getFullYear() === parseInt(dateFilter.year);

        return matchesStatusFilter && matchesSearch && matchesDay && matchesMonth && matchesYear;
    });

    const getStatusCount = (status: string) => {
        if (status === 'all') return orders.length;
        return orders.filter(o => {
            const prev = activeStatus;
            const result = (() => {
                if (status === 'pending_payment') {
                    return o.payment_status === 'pending' && o.status === 'pending';
                }
                if (status === 'pending_confirmation') {
                    return o.status === 'pending_confirmation';
                }
                return o.status === status;
            })();
            return result;
        }).length;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{title}</h1>
                    <p className="text-white/50 mt-1">
                        {loading ? 'Đang tải...' : subtitle || `${filteredOrders.length} đơn hàng`}
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

            <div className="flex gap-2 overflow-x-auto pb-2">
                {statusTabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveStatus(tab.key)}
                        className={`
                            flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all
                            ${activeStatus === tab.key
                                ? 'bg-white text-black'
                                : 'bg-[#1D1D1F] text-white/70 hover:text-white border border-white/10'
                            }
                        `}
                    >
                        {tab.label}
                        <span className={`px-1.5 py-0.5 rounded text-xs ${activeStatus === tab.key ? 'bg-black/10' : 'bg-white/10'}`}>
                            {getStatusCount(tab.key)}
                        </span>
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Tìm theo mã đơn hoặc khách hàng..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-2.5 bg-[#1D1D1F] border border-white/10 rounded-xl text-white placeholder:text-white/40 text-sm"
                    />
                </div>

                <div className="flex gap-2 items-center flex-wrap">
                    <span className="text-white/50 text-sm">Lọc:</span>
                    <input
                        type="number"
                        placeholder="Ngày"
                        min="1"
                        max="31"
                        value={dateFilter.day}
                        onChange={(e) => setDateFilter({ ...dateFilter, day: e.target.value })}
                        className="w-16 px-2 py-2 bg-[#1D1D1F] border border-white/10 rounded-xl text-white placeholder:text-white/40 text-sm"
                    />
                    <select
                        value={dateFilter.month}
                        onChange={(e) => setDateFilter({ ...dateFilter, month: e.target.value })}
                        className="w-24 px-2 py-2 bg-[#1D1D1F] border border-white/10 rounded-xl text-white text-sm"
                    >
                        <option value="">Tháng</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                            <option key={m} value={m}>T{m}</option>
                        ))}
                    </select>
                    <input
                        type="number"
                        placeholder="Năm"
                        min="2020"
                        max="2030"
                        value={dateFilter.year}
                        onChange={(e) => setDateFilter({ ...dateFilter, year: e.target.value })}
                        className="w-20 px-2 py-2 bg-[#1D1D1F] border border-white/10 rounded-xl text-white placeholder:text-white/40 text-sm"
                    />
                    {(dateFilter.day || dateFilter.month || dateFilter.year) && (
                        <button
                            onClick={() => setDateFilter({ day: '', month: '', year: '' })}
                            className="px-2 py-2 text-white/50 hover:text-white text-sm"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 overflow-hidden"
            >
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-white/50">Không có đơn hàng nào</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Mã đơn</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Khách hàng</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">IG</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Tổng tiền</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Trạng thái</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Ngày tạo</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Note KH</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Ghi chú nội bộ</th>
                                    <th className="px-5 py-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map((order) => {
                                    const shippingInfo = order.shipping_address_snapshot as any;
                                    return (
                                        <tr
                                            key={order.id}
                                            className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                                            onClick={() => window.location.href = `${adminRoot}/orders/${order.id}`}
                                        >
                                            <td className="px-5 py-4">
                                                <Link href={`${adminRoot}/orders/${order.id}`} className="text-white font-medium hover:underline">
                                                    {order.order_code}
                                                </Link>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div>
                                                    <span className="text-white block">
                                                        {order.profiles?.full_name || shippingInfo?.full_name || 'Khách vãng lai'}
                                                    </span>
                                                    <span className="text-white/50 text-sm">
                                                        {order.profiles?.phone || shippingInfo?.phone || '-'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-white/20 text-sm">-</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-white font-medium">
                                                    {Number(order.total_amount).toLocaleString('vi-VN')}đ
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-white/10 text-white/50'}`}>
                                                    {statusLabels[order.status] || order.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-white/70 text-sm">
                                                    {new Date(order.created_at).toLocaleString('vi-VN', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                {order.notes ? (
                                                    <span className="text-blue-400/80 text-sm truncate max-w-[150px] block" title={order.notes}>
                                                        {order.notes.length > 25 ? order.notes.substring(0, 25) + '...' : order.notes}
                                                    </span>
                                                ) : (
                                                    <span className="text-white/20 text-sm">-</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                {order.admin_notes ? (
                                                    <span className="text-yellow-400/80 text-sm truncate max-w-[150px] block" title={order.admin_notes}>
                                                        {order.admin_notes.length > 25 ? order.admin_notes.substring(0, 25) + '...' : order.admin_notes}
                                                    </span>
                                                ) : (
                                                    <span className="text-white/20 text-sm">-</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-2">
                                                    {(order.payment_status === 'pending' || order.status === 'pending_confirmation') && (
                                                        <button
                                                            onClick={() => handleConfirmPayment(order.id)}
                                                            disabled={confirming === order.id}
                                                            className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30 disabled:opacity-50"
                                                        >
                                                            {confirming === order.id ? '...' : 'Xác nhận TT'}
                                                        </button>
                                                    )}
                                                    {order.status === 'confirmed' && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(order.id, 'processing')}
                                                            className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm hover:bg-purple-500/30"
                                                        >
                                                            Xử lý
                                                        </button>
                                                    )}
                                                    {order.status === 'processing' && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(order.id, 'shipping')}
                                                            className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30"
                                                        >
                                                            Gửi hàng
                                                        </button>
                                                    )}
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
