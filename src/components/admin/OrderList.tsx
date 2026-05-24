'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Order, OrderType } from '@/types/database';
import { formatOrderDate } from '@/lib/utils/orderStatus';

const statusTabs = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Chờ thanh toán' },
    { key: 'paid', label: 'Đã thanh toán' },
    { key: 'preparing', label: 'Đang chuẩn bị' },
    { key: 'shipped', label: 'Đã gửi hàng' },
    { key: 'delivered', label: 'Đã giao' },
];

const statusLabels: Record<string, string> = {
    pending: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    confirmed: 'Đã xác nhận',
    processing: 'Đang xử lý',
    producing: 'Đang sản xuất',
    shipped: 'Đã gửi hàng',
    delivered: 'Đã giao',
    cancelled: 'Đã hủy',
    refunded: 'Đã hoàn tiền',
    designing: 'Đang thiết kế',
    completed: 'Hoàn thành',
    shipping: 'Đang giao hàng'
};

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    paid: 'bg-blue-500/20 text-blue-400',
    confirmed: 'bg-blue-500/20 text-blue-400',
    processing: 'bg-indigo-500/20 text-indigo-400',
    producing: 'bg-purple-500/20 text-purple-400',
    shipping: 'bg-cyan-500/20 text-cyan-400',
    delivered: 'bg-green-500/20 text-green-400',
    completed: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
    refunded: 'bg-red-500/20 text-red-400',
    designing: 'bg-pink-500/20 text-pink-400',
};

// Removed typeLabels/typeColors as order_type is gone in V3

interface OrderListProps {
    orderType?: string | 'all'; // Kept for compatibility but logically less relevant
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

function getOrderShippingInfo(order: OrderWithProfile) {
    return ((order as any).shipping_address_snapshot || (order as any).shipping_address || {}) as {
        full_name?: string;
        phone?: string;
    };
}

function getOrderCustomerName(order: OrderWithProfile) {
    const shippingInfo = getOrderShippingInfo(order);
    return order.profiles?.full_name
        || (order.profiles as any)?.name
        || shippingInfo.full_name
        || order.profiles?.email?.split('@')[0]
        || 'Chưa có tên khách hàng';
}

function getOrderCustomerPhone(order: OrderWithProfile) {
    const shippingInfo = getOrderShippingInfo(order);
    return order.profiles?.phone || shippingInfo.phone || '-';
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

    // Detect dynamic admin root path
    const pathParts = pathname.split('/');
    const adminRoot = pathParts.length >= 2 && pathParts[1].length >= 40 ? `/${pathParts[1]}` : '/sys_internal';

    useEffect(() => {
        fetchOrders();
    }, [orderType]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            // Use admin API to bypass RLS and get profiles
            // Note: API might need update to ignore 'type' param if no longer relevant
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
        setConfirming(orderId);
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'paid', payment_status: 'paid' }),
            });
            const json = await res.json();

            if (json.success) {
                setOrders(orders.map(o =>
                    o.id === orderId
                        ? { ...o, status: 'paid' as const, payment_status: 'paid' as const }
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

    // Filter orders
    const filteredOrders = orders.filter(order => {
        const actualType = (order as any).order_type || 'ready_made';
        const matchesType = orderType === 'all'
            || (orderType === 'ready_made' && (actualType === 'ready_made' || actualType === 'product'))
            || (orderType === 'printing' && (actualType === 'printing' || actualType === 'print_3d'))
            || actualType === orderType;
        const matchesStatus = activeStatus === 'all' || order.status === activeStatus;
        const profile = order.profiles as { full_name?: string; email?: string } | null;

        const shippingInfo = getOrderShippingInfo(order);
        const customerName = getOrderCustomerName(order);
        const customerPhone = getOrderCustomerPhone(order);
        // Search by cart_code (preferred), order_code (fallback), customer name, or user_id
        const displayCode = (order as any).cart_code || order.order_code;
        const matchesSearch =
            displayCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.order_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            customerPhone.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (shippingInfo.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (order.user_id && order.user_id.toLowerCase().includes(searchTerm.toLowerCase()));

        // Date filter
        const orderDate = order.created_at ? new Date(order.created_at) : null;
        const hasValidDate = !!orderDate && !Number.isNaN(orderDate.getTime());
        const matchesDay = !dateFilter.day || (hasValidDate && orderDate.getDate() === parseInt(dateFilter.day));
        const matchesMonth = !dateFilter.month || (hasValidDate && (orderDate.getMonth() + 1) === parseInt(dateFilter.month));
        const matchesYear = !dateFilter.year || (hasValidDate && orderDate.getFullYear() === parseInt(dateFilter.year));

        return matchesType && matchesStatus && matchesSearch && matchesDay && matchesMonth && matchesYear;
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
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
                    <p className="text-[var(--text-secondary)] mt-1">
                        {loading ? 'Đang tải...' : subtitle || `${filteredOrders.length} đơn hàng`}
                    </p>
                </div>
                <button
                    onClick={fetchOrders}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[var(--material-panel)] border border-[var(--border-color)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                    {/* SVG Icon */}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Làm mới
                </button>
            </div>

            {/* Status Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {statusTabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveStatus(tab.key)}
                        className={`
                            flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all
                            ${activeStatus === tab.key
                                ? 'bg-white text-black'
                                : 'bg-[var(--material-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
                            }
                        `}
                    >
                        {tab.label}
                        <span className={`px-1.5 py-0.5 rounded text-xs ${activeStatus === tab.key ? 'bg-black/10' : 'bg-[var(--material-glass)]'}`}>
                            {getStatusCount(tab.key)}
                        </span>
                    </button>
                ))}
            </div>

            {/* Search & Date Filter */}
            <div className="flex flex-wrap gap-4 items-center justify-between">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    {/* Search Input */}
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Tìm theo mã đơn hoặc khách hàng..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-2.5 bg-[var(--material-panel)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] text-sm"
                    />
                </div>

                {/* Date Filter */}
                <div className="flex gap-2 items-center flex-wrap">
                    <span className="text-[var(--text-secondary)] text-sm">Lọc:</span>
                    <input
                        type="number"
                        placeholder="Ngày"
                        min="1"
                        max="31"
                        value={dateFilter.day}
                        onChange={(e) => setDateFilter({ ...dateFilter, day: e.target.value })}
                        className="w-16 px-2 py-2 bg-[var(--material-panel)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] text-sm"
                    />
                    <select
                        value={dateFilter.month}
                        onChange={(e) => setDateFilter({ ...dateFilter, month: e.target.value })}
                        className="w-24 px-2 py-2 bg-[var(--material-panel)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm"
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
                        className="w-20 px-2 py-2 bg-[var(--material-panel)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] text-sm"
                    />
                    {(dateFilter.day || dateFilter.month || dateFilter.year) && (
                        <button
                            onClick={() => setDateFilter({ day: '', month: '', year: '' })}
                            className="px-2 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Orders Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] overflow-hidden"
            >
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-white rounded-full animate-spin" />
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-[var(--text-secondary)]">Không có đơn hàng nào</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-[var(--material-glass)]">
                                <tr>
                                    <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Mã đơn</th>
                                    <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Khách hàng</th>
                                    <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">IG</th>
                                    {/* Order Type Removed */}
                                    <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Tổng tiền</th>
                                    <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Trạng thái</th>
                                    <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Ngày tạo</th>
                                    <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Note KH</th>
                                    <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Ghi chú nội bộ</th>
                                    <th className="px-5 py-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map((order) => {
                                    const customerName = getOrderCustomerName(order);
                                    const customerPhone = getOrderCustomerPhone(order);
                                    return (
                                        <tr
                                            key={order.id}
                                            className="border-b border-[var(--border-color)] hover:bg-[var(--material-glass)] transition-colors cursor-pointer"
                                            onClick={() => window.location.href = `${adminRoot}/orders/${order.id}`}
                                        >
                                            <td className="px-5 py-4">
                                                <Link href={`${adminRoot}/orders/${order.id}`} className="text-[var(--text-primary)] font-medium hover:underline">
                                                    {/* Display cart_code if available, fallback to order_code */}
                                                    {(order as any).cart_code || order.order_code}
                                                </Link>
                                                {/* Show legacy order_code if cart_code exists (for reference) */}
                                                {(order as any).cart_code && (
                                                    <span className="block text-[var(--text-tertiary)] text-xs mt-0.5">
                                                        Code: {order.order_code}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div>
                                                    <span className="text-[var(--text-primary)] block">
                                                        {customerName}
                                                    </span>
                                                    <span className="text-[var(--text-secondary)] text-sm">
                                                        {customerPhone}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                {/* Instagram handling needs profile enrichment or removal if not collected */}
                                                <span className="text-[var(--text-tertiary)] text-sm">-</span>
                                            </td>

                                            <td className="px-5 py-4">
                                                <span className="text-[var(--text-primary)] font-medium">
                                                    {Number(order.total_amount).toLocaleString('vi-VN')}đ
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-[var(--material-glass)] text-[var(--text-secondary)]'}`}>
                                                    {statusLabels[order.status] || order.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-[var(--text-secondary)] text-sm">
                                                    {formatOrderDate(order.created_at)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                {order.notes ? (
                                                    <span className="text-blue-400/80 text-sm truncate max-w-[150px] block" title={order.notes}>
                                                        {order.notes.length > 25 ? order.notes.substring(0, 25) + '...' : order.notes}
                                                    </span>
                                                ) : (
                                                    <span className="text-[var(--text-tertiary)] text-sm">-</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                {order.admin_notes ? (
                                                    <span className="text-yellow-400/80 text-sm truncate max-w-[150px] block" title={order.admin_notes}>
                                                        {order.admin_notes.length > 25 ? order.admin_notes.substring(0, 25) + '...' : order.admin_notes}
                                                    </span>
                                                ) : (
                                                    <span className="text-[var(--text-tertiary)] text-sm">-</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link
                                                        href={`${adminRoot}/orders/${order.id}`}
                                                        className="px-3 py-1.5 bg-white/10 text-[var(--text-primary)] rounded-lg text-sm hover:bg-white/20 whitespace-nowrap"
                                                    >
                                                        Xem
                                                    </Link>
                                                    {order.status === 'pending' && (
                                                        <button
                                                            onClick={() => handleConfirmPayment(order.id)}
                                                            disabled={confirming === order.id}
                                                            className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30 disabled:opacity-50"
                                                        >
                                                            {confirming === order.id ? '...' : 'Xác nhận TT'}
                                                        </button>
                                                    )}
                                                    {order.status === 'paid' && (
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

