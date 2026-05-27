'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAdminPath } from '@/hooks/useAdminPath';
import type { Profile, Order } from '@/types/database';
import { formatOrderDate } from '@/lib/utils/orderStatus';

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    confirmed: 'bg-blue-500/20 text-blue-400', // Added confirmed
    paid: 'bg-blue-500/20 text-blue-400',
    processing: 'bg-purple-500/20 text-purple-400', // Changed/Added
    producing: 'bg-purple-500/20 text-purple-400', // Added producing
    shipped: 'bg-cyan-500/20 text-cyan-400',
    delivered: 'bg-green-500/20 text-green-400',
    completed: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ TT',
    confirmed: 'Đã xác nhận',
    paid: 'Đã TT',
    processing: 'Đang xử lý',
    producing: 'Đang sản xuất',
    shipped: 'Đang giao',
    delivered: 'Đã giao',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
};

export default function AdminCustomerDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { adminRoot } = useAdminPath();

    const [loading, setLoading] = useState(true);
    const [customer, setCustomer] = useState<Profile | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [addresses, setAddresses] = useState<Array<{
        id: string;
        full_name: string;
        phone: string;
        address_line: string;
        ward: string;
        district: string;
        province: string;
        is_default: boolean;
    }>>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (params.id) {
            fetchCustomerData(params.id as string);
        }
    }, [params.id]);

    const fetchCustomerData = async (id: string) => {
        try {
            // Use API route with service role to bypass RLS
            const res = await fetch(`/api/admin/customers/${id}`);
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Không tìm thấy khách hàng');
                setLoading(false);
                return;
            }

            setCustomer(data.profile);
            setAddresses(data.addresses || []);
            setOrders(data.orders || []);
        } catch (err) {
            console.error('Fetch customer error:', err);
            setError('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    };

    const totalSpent = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !customer) {
        return (
            <div className="text-center py-20">
                <p className="text-red-400">{error || 'Không tìm thấy khách hàng'}</p>
                <Link href={`${adminRoot}/customers`} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] mt-4 inline-block">
                    ← Quay lại
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href={`${adminRoot}/customers`}
                        className="p-2 rounded-xl hover:bg-[var(--material-glass)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{customer.full_name || 'Chưa có tên'}</h1>
                        <p className="text-[var(--text-secondary)] mt-1">Mã KH: {customer.customer_code}</p>
                    </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${customer.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'
                    }`}>
                    {customer.role === 'admin' ? 'Admin' : 'Khách hàng'}
                </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="lg:col-span-2 bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6 space-y-6"
                >
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Thông tin liên hệ</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[var(--text-secondary)] text-sm block mb-1">Họ tên</label>
                            <p className="text-[var(--text-primary)]">{customer.full_name || '-'}</p>
                        </div>
                        <div>
                            <label className="text-[var(--text-secondary)] text-sm block mb-1">Email</label>
                            <p className="text-[var(--text-primary)]">{customer.email || '-'}</p>
                        </div>
                        <div>
                            <label className="text-[var(--text-secondary)] text-sm block mb-1">Số điện thoại</label>
                            <p className="text-[var(--text-primary)]">{customer.phone || '-'}</p>
                        </div>
                        {/* <div>
                            <label className="text-[var(--text-secondary)] text-sm block mb-1">Instagram</label>
                            <p className="text-[var(--text-primary)]">{customer.instagram || '-'}</p>
                        </div> */}
                    </div>

                    <div className="pt-4 border-t border-[var(--border-color)]">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-4 rounded-xl bg-[var(--material-glass)]">
                                <p className="text-2xl font-bold text-[var(--text-primary)]">{orders.length}</p>
                                <p className="text-[var(--text-secondary)] text-sm">Đơn hàng</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-[var(--material-glass)]">
                                <p className="text-2xl font-bold text-green-400">{totalSpent.toLocaleString('vi-VN')} VND</p>
                                <p className="text-[var(--text-secondary)] text-sm">Tổng chi tiêu</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-[var(--material-glass)]">
                                <p className="text-2xl font-bold text-[var(--text-primary)]">
                                    {formatOrderDate(customer.created_at)}
                                </p>
                                <p className="text-[var(--text-secondary)] text-sm">Ngày tham gia</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Sidebar stats */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-6"
                >
                    <div className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6">
                        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Địa chỉ giao hàng</h3>
                        {addresses.length > 0 ? (
                            <div className="space-y-4 max-h-[180px] overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                {addresses.map((addr) => (
                                    <div key={addr.id} className="space-y-2 text-sm p-3 bg-[var(--material-glass)] rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[var(--text-primary)] font-medium">{addr.full_name}</p>
                                            {addr.is_default && (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                                                    Mặc định
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[var(--text-secondary)]">{addr.phone}</p>
                                        <p className="text-[var(--text-secondary)]">
                                            {addr.address_line}
                                            {addr.ward && `, ${addr.ward}`}
                                            {addr.district && `, ${addr.district}`}
                                            {addr.province && `, ${addr.province}`}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[var(--text-secondary)] text-sm">Chưa có địa chỉ</p>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Order history */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6"
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Lịch sử đơn hàng</h2>
                    <span className="text-[var(--text-secondary)] text-sm">{orders.length} đơn</span>
                </div>

                {orders.length === 0 ? (
                    <p className="text-center text-[var(--text-secondary)] py-8">Chưa có đơn hàng nào</p>
                ) : (
                    <div className="space-y-3">
                        {orders.map((order) => (
                            <Link
                                key={order.id}
                                href={`${adminRoot}/orders/${order.id}`}
                                className="flex items-center justify-between p-4 rounded-xl bg-[var(--material-glass)] hover:bg-[var(--material-glass)] transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--material-glass)] flex items-center justify-center">
                                        <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <span className="text-[var(--text-primary)] font-medium block">{order.order_code}</span>
                                        <span className="text-[var(--text-secondary)] text-sm">
                                            {formatOrderDate(order.created_at)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-[var(--text-primary)] font-medium">
                                        {order.total_amount.toLocaleString('vi-VN')} VND
                                    </span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-[var(--material-glass)] text-[var(--text-secondary)]'}`}>
                                        {statusLabels[order.status] || order.status}
                                    </span>
                                    <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
