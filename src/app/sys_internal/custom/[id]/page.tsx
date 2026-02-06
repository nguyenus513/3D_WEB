'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase/client';
import { useAdminPath } from '@/hooks/useAdminPath';

interface Order {
    id: string;
    order_code: string;
    status: string;
    subtotal: number;
    shipping_fee: number;
    total: number;
    deposit_amount: number;
    deposit_paid: boolean;
    admin_note: string | null;
    customer_note: string | null;
    shipping_address: {
        name: string;
        phone: string;
        address: string;
        ward: string;
        district: string;
        province: string;
    } | null;
    shipping_code: string | null;
    created_at: string;
    paid_at: string | null;
    custom_config: {
        type: string;
        size: string;
        notes: string;
        images: { id: string; name: string; url: string; thumbnail: string }[];
    };
    profiles: {
        full_name: string;
        email: string;
        phone: string;
        customer_code: string;
    };
}

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    paid: 'bg-blue-500/20 text-blue-400',
    designing: 'bg-purple-500/20 text-purple-400',
    review: 'bg-cyan-500/20 text-cyan-400',
    approved: 'bg-emerald-500/20 text-emerald-400',
    processing: 'bg-indigo-500/20 text-indigo-400',
    shipping: 'bg-orange-500/20 text-orange-400',
    delivered: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    designing: 'Đang thiết kế',
    review: 'Chờ duyệt mẫu',
    approved: 'Khách đã duyệt',
    processing: 'Đang sản xuất',
    shipping: 'Đang giao hàng',
    delivered: 'Đã giao hàng',
    cancelled: 'Đã hủy',
};

const statusFlow = ['paid', 'designing', 'review', 'approved', 'processing', 'shipping', 'delivered'];

export default function AdminCustomDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { adminRoot } = useAdminPath();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [adminNote, setAdminNote] = useState('');

    useEffect(() => {
        fetchOrder();
    }, [params.id]);

    const fetchOrder = async () => {
        try {
            // Use admin API to bypass RLS - it returns order + profile
            const res = await fetch(`/api/admin/orders/${params.id}`);
            const data = await res.json();

            if (!res.ok || data.error) {
                setError('Không tìm thấy đơn hàng');
                setLoading(false);
                return;
            }

            const orderData = data.order;
            const profileData = data.profile;

            // Verify this is a custom order
            if (orderData.order_type !== 'custom') {
                setError('Đơn hàng này không phải đơn Custom');
                setLoading(false);
                return;
            }

            setOrder({
                ...orderData,
                profiles: profileData,
                custom_config: orderData.custom_config
            });
            setAdminNote(orderData.admin_note || '');
            setLoading(false);
        } catch (err) {
            console.error('Fetch error:', err);
            setError('Không thể tải đơn hàng');
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (newStatus: string) => {
        if (!order) return;
        setSaving(true);

        try {
            await fetch(`/api/admin/orders/${order.id}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            await fetchOrder();
        } catch (error) {
            console.error('Error updating status:', error);
        }
        setSaving(false);
    };

    const handleSaveNote = async () => {
        if (!order) return;
        setSaving(true);
        try {
            await fetch(`/api/admin/orders/${order.id}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_note: adminNote }),
            });
        } catch (error) {
            console.error('Error saving note:', error);
        }
        setSaving(false);
    };

    const handleConfirmPayment = async () => {
        if (!order) return;
        setSaving(true);
        try {
            await fetch(`/api/admin/orders/${order.id}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'paid' }),
            });
            await fetchOrder();
        } catch (error) {
            console.error('Error confirming payment:', error);
        }
        setSaving(false);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('vi-VN');
    };

    const getNextStatus = () => {
        if (!order) return null;
        const currentIndex = statusFlow.indexOf(order.status);
        if (currentIndex >= 0 && currentIndex < statusFlow.length - 1) {
            return statusFlow[currentIndex + 1];
        }
        return null;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="text-center py-20">
                <p className="text-red-400 mb-4">{error || 'Không tìm thấy đơn hàng'}</p>
                <Link href={`${adminRoot}/orders/custom`} className="text-blue-400 hover:underline">← Quay lại danh sách</Link>
            </div>
        );
    }

    const nextStatus = getNextStatus();
    const remaining = order.total - order.deposit_amount;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`${adminRoot}/orders/custom`} className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Đơn Custom</h1>
                        <p className="text-white/50 mt-1">{order.order_code}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-4 py-2 rounded-xl text-sm font-medium ${statusColors[order.status]}`}>
                        {statusLabels[order.status] || order.status}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer Info */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-4">Thông tin khách hàng</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-white/50 text-sm">Tên</p>
                                <p className="text-white font-medium">{order.profiles?.full_name || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-white/50 text-sm">Mã KH</p>
                                <p className="text-white font-mono">{order.profiles?.customer_code || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-white/50 text-sm">Email</p>
                                <p className="text-white">{order.profiles?.email || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-white/50 text-sm">SĐT</p>
                                <p className="text-white">{order.profiles?.phone || 'N/A'}</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Custom Config */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-4">Chi tiết đơn Custom</h2>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/50 text-sm">Loại</p>
                                <p className="text-white font-medium capitalize">{order.custom_config?.type || 'N/A'}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/50 text-sm">Kích thước</p>
                                <p className="text-white font-medium">{order.custom_config?.size || 'N/A'}</p>
                            </div>
                        </div>

                        {order.custom_config?.notes && (
                            <div className="p-4 bg-white/5 rounded-xl mb-4">
                                <p className="text-white/50 text-sm mb-1">Ghi chú từ khách</p>
                                <p className="text-white">{order.custom_config.notes}</p>
                            </div>
                        )}

                        {/* Customer Images */}
                        {order.custom_config?.images?.length > 0 && (
                            <div>
                                <p className="text-white/50 text-sm mb-2">Ảnh tham khảo từ khách ({order.custom_config.images.length} ảnh)</p>
                                <div className="grid grid-cols-3 gap-3">
                                    {order.custom_config.images.map((img, i) => (
                                        <a
                                            key={i}
                                            href={img.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="aspect-square rounded-xl bg-white/10 overflow-hidden hover:ring-2 ring-white/50 transition-all"
                                        >
                                            <img
                                                src={img.thumbnail || img.url}
                                                alt={`Ảnh ${i + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>

                    {/* Shipping Address */}
                    {order.shipping_address && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                        >
                            <h2 className="text-lg font-semibold text-white mb-4">Địa chỉ giao hàng</h2>
                            <div className="space-y-1">
                                <p className="text-white font-medium">{order.shipping_address.name}</p>
                                <p className="text-white/70">{order.shipping_address.phone}</p>
                                <p className="text-white/50">
                                    {order.shipping_address.address}, {order.shipping_address.ward}, {order.shipping_address.district}, {order.shipping_address.province}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Admin Note */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-4">Ghi chú Admin</h2>
                        <textarea
                            value={adminNote}
                            onChange={(e) => setAdminNote(e.target.value)}
                            placeholder="Ghi chú nội bộ..."
                            className="w-full p-4 bg-white/5 rounded-xl text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-white/20"
                            rows={3}
                        />
                        <button
                            onClick={handleSaveNote}
                            disabled={saving}
                            className="mt-3 px-4 py-2 bg-white/10 rounded-xl text-white text-sm hover:bg-white/20 disabled:opacity-50"
                        >
                            {saving ? 'Đang lưu...' : 'Lưu ghi chú'}
                        </button>
                    </motion.div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Payment */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h3 className="text-lg font-semibold text-white mb-4">Thanh toán</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-white/50">Tạm tính</span>
                                <span className="text-white">{order.subtotal.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/50">Tạm tính</span>
                                <span className="text-white">{order.subtotal.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="border-t border-white/10 pt-3 flex justify-between">
                                <span className="text-white font-medium">Tổng cộng</span>
                                <span className="text-white font-bold">{order.total.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/50">Đã cọc (50%)</span>
                                <span className={order.deposit_paid ? 'text-green-400' : 'text-yellow-400'}>
                                    {order.deposit_amount.toLocaleString('vi-VN')}đ
                                    {!order.deposit_paid && ' (chưa TT)'}
                                </span>
                            </div>
                            {remaining > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-white/50">Còn lại</span>
                                    <span className="text-white">{remaining.toLocaleString('vi-VN')}đ</span>
                                </div>
                            )}
                        </div>

                        {/* Confirm payment button */}
                        {order.status === 'pending' && !order.deposit_paid && (
                            <button
                                onClick={handleConfirmPayment}
                                disabled={saving}
                                className="w-full mt-4 py-3 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 disabled:opacity-50"
                            >
                                {saving ? 'Đang xử lý...' : '✓ Xác nhận đã nhận cọc'}
                            </button>
                        )}
                    </motion.div>

                    {/* Timeline */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h3 className="text-lg font-semibold text-white mb-4">Timeline</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-white/50">Tạo đơn</span>
                                <span className="text-white">{formatDate(order.created_at)}</span>
                            </div>
                            {order.paid_at && (
                                <div className="flex justify-between">
                                    <span className="text-white/50">Thanh toán</span>
                                    <span className="text-white">{formatDate(order.paid_at)}</span>
                                </div>
                            )}
                            {order.shipping_code && (
                                <div className="flex justify-between">
                                    <span className="text-white/50">Mã vận đơn</span>
                                    <span className="text-white font-mono">{order.shipping_code}</span>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-3"
                    >
                        <h3 className="text-lg font-semibold text-white mb-4">Thao tác</h3>

                        {nextStatus && (
                            <button
                                onClick={() => handleUpdateStatus(nextStatus)}
                                disabled={saving}
                                className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 disabled:opacity-50"
                            >
                                {saving ? 'Đang xử lý...' : `→ ${statusLabels[nextStatus]}`}
                            </button>
                        )}

                        {order.status !== 'cancelled' && order.status !== 'delivered' && (
                            <button
                                onClick={() => handleUpdateStatus('cancelled')}
                                disabled={saving}
                                className="w-full py-3 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/10"
                            >
                                Hủy đơn hàng
                            </button>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
