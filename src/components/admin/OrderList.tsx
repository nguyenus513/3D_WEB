'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase/client';
import type { Order, OrderType } from '@/types/database';

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

interface OrderListProps {
    orderType?: OrderType | 'all';
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
            const response = await fetch(`/api/admin/orders?type=${orderType}`);
            const json = await response.json();

            // API returns { success: true, data: { orders, total, ... } }
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
                body: JSON.stringify({ status: 'paid' }),
            });
            const json = await res.json();

            if (json.success) {
                setOrders(orders.map(o =>
                    o.id === orderId
                        ? { ...o, status: 'paid' as const, deposit_paid: true }
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
                    o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o
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
        const matchesStatus = activeStatus === 'all' || order.status === activeStatus;
        const profile = order.profiles as { full_name?: string; email?: string } | null;
        const matchesSearch = order.order_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.code_formatted?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            profile?.email?.toLowerCase().includes(searchTerm.toLowerCase());

        // Date filter
        const orderDate = new Date(order.created_at);
        const matchesDay = !dateFilter.day || orderDate.getDate() === parseInt(dateFilter.day);
        const matchesMonth = !dateFilter.month || (orderDate.getMonth() + 1) === parseInt(dateFilter.month);
        const matchesYear = !dateFilter.year || orderDate.getFullYear() === parseInt(dateFilter.year);

        return matchesStatus && matchesSearch && matchesDay && matchesMonth && matchesYear;
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

            {/* Search & Date Filter */}
            <div className="flex flex-wrap gap-4 items-center justify-between">
                {/* Search */}
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

                {/* Date Filter */}
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
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Orders Table */}
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
                        <svg className="w-16 h-16 text-white/20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
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
                                    {orderType === 'all' && (
                                        <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Loại</th>
                                    )}
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Tổng tiền</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Trạng thái</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Ngày tạo</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Note KH</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Ghi chú nội bộ</th>
                                    <th className="px-5 py-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map((order) => (
                                    <tr
                                        key={order.id}
                                        className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                                        onClick={() => window.location.href = `${adminRoot}/orders/${order.id}`}
                                    >
                                        <td className="px-5 py-4">
                                            <Link href={`${adminRoot}/orders/${order.id}`} className="text-white font-medium hover:underline">
                                                {order.code_formatted || order.order_code}
                                            </Link>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div>
                                                <span className="text-white block">
                                                    {order.profiles?.full_name || order.shipping_address?.full_name || 'Khách vãng lai'}
                                                </span>
                                                <span className="text-white/50 text-sm">
                                                    {order.profiles?.phone || order.shipping_address?.phone || '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            {order.profiles?.instagram_username ? (
                                                <a
                                                    href={`https://instagram.com/${order.profiles.instagram_username}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-pink-400 hover:underline text-sm"
                                                >
                                                    @{order.profiles.instagram_username}
                                                </a>
                                            ) : (
                                                <span className="text-white/20 text-sm">-</span>
                                            )}
                                        </td>
                                        {orderType === 'all' && (
                                            <td className="px-5 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[order.order_type] || ''}`}>
                                                    {typeLabels[order.order_type] || order.order_type}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-5 py-4">
                                            <span className="text-white font-medium">
                                                {Number(order.total).toLocaleString('vi-VN')}đ
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
                                                    second: '2-digit',
                                                })}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            {order.customer_note ? (
                                                <span className="text-blue-400/80 text-sm truncate max-w-[150px] block" title={order.customer_note}>
                                                    {order.customer_note.length > 25 ? order.customer_note.substring(0, 25) + '...' : order.customer_note}
                                                </span>
                                            ) : (
                                                <span className="text-white/20 text-sm">-</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            {order.admin_note ? (
                                                <span className="text-yellow-400/80 text-sm truncate max-w-[150px] block" title={order.admin_note}>
                                                    {order.admin_note.length > 25 ? order.admin_note.substring(0, 25) + '...' : order.admin_note}
                                                </span>
                                            ) : (
                                                <span className="text-white/20 text-sm">-</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-2">
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
                                                        onClick={() => handleUpdateStatus(order.id, 'preparing')}
                                                        className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm hover:bg-purple-500/30"
                                                    >
                                                        Chuẩn bị
                                                    </button>
                                                )}
                                                {order.status === 'preparing' && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(order.id, 'shipped')}
                                                        className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30"
                                                    >
                                                        Gửi hàng
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
