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
    printing_config: {
        type: 'fdm' | 'resin';
        color: string;
        quantity: number;
        notes?: string;
        analysis: {
            grams: number;
            hours: number;
            price: number;
            volume: number;
            boundingBox: { x: number; y: number; z: number };
        };
        files: { id: string; name: string; url: string }[];
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
    printing: 'bg-purple-500/20 text-purple-400',
    shipping: 'bg-orange-500/20 text-orange-400',
    delivered: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    printing: 'Đang in',
    shipping: 'Đang giao hàng',
    delivered: 'Đã giao hàng',
    cancelled: 'Đã hủy',
};

const statusFlow = ['paid', 'printing', 'shipping', 'delivered'];

export default function AdminPrintingDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { adminRoot } = useAdminPath();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [adminNote, setAdminNote] = useState('');
    const [shippingCode, setShippingCode] = useState('');

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

            // Verify this is a printing order
            if (orderData.order_type !== 'printing') {
                setError('Đơn hàng này không phải đơn In 3D');
                setLoading(false);
                return;
            }

            setOrder({
                ...orderData,
                profiles: profileData,
                printing_config: orderData.printing_config
            });
            setAdminNote(orderData.admin_note || '');
            setShippingCode(orderData.shipping_code || '');
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
            const updates: Record<string, unknown> = { status: newStatus };
            if (newStatus === 'shipping' && shippingCode) {
                updates.shipping_code = shippingCode;
            }

            await fetch(`/api/admin/orders/${order.id}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
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
                <Link href={`${adminRoot}/orders/printing`} className="text-blue-400 hover:underline">← Quay lại danh sách</Link>
            </div>
        );
    }

    const nextStatus = getNextStatus();
    const config = order.printing_config;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`${adminRoot}/orders/printing`} className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Đơn In 3D</h1>
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

                    {/* Printing Config */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-4">Chi tiết In 3D</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/50 text-sm">Loại in</p>
                                <p className="text-white font-bold uppercase">{config?.type || 'N/A'}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/50 text-sm">Màu</p>
                                <p className="text-white font-medium capitalize">{config?.color || 'N/A'}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/50 text-sm">Số lượng</p>
                                <p className="text-white font-medium">×{config?.quantity || 1}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/50 text-sm">Khối lượng</p>
                                <p className="text-white font-bold">{config?.analysis?.grams || 0}g</p>
                            </div>
                        </div>

                        {/* Analysis */}
                        {config?.analysis && (
                            <div className="grid grid-cols-3 gap-4 p-4 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl mb-4">
                                <div className="text-center">
                                    <p className="text-white/50 text-xs">Thể tích</p>
                                    <p className="text-white font-medium">{config.analysis.volume} cm³</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-white/50 text-xs">Thời gian in</p>
                                    <p className="text-white font-medium">{config.analysis.hours} giờ</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-white/50 text-xs">Kích thước</p>
                                    <p className="text-white font-medium text-sm">
                                        {config.analysis.boundingBox?.x} × {config.analysis.boundingBox?.y} × {config.analysis.boundingBox?.z} mm
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Files */}
                        {config?.files?.length > 0 && (
                            <div>
                                <p className="text-white/50 text-sm mb-2">File 3D</p>
                                <div className="space-y-2">
                                    {config.files.map((file, i) => (
                                        <a
                                            key={i}
                                            href={file.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                                        >
                                            <span className="text-2xl">📄</span>
                                            <span className="text-white">{file.name}</span>
                                            <span className="ml-auto text-blue-400 text-sm">Tải xuống →</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {config?.notes && (
                            <div className="mt-4 p-4 bg-white/5 rounded-xl">
                                <p className="text-white/50 text-sm mb-1">Ghi chú từ khách</p>
                                <p className="text-white">{config.notes}</p>
                            </div>
                        )}
                    </motion.div>

                    {/* Admin Note */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
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
                                <span className="text-white/50">Phí ship</span>
                                <span className="text-white">{order.shipping_fee.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="border-t border-white/10 pt-3 flex justify-between">
                                <span className="text-white font-medium">Tổng cộng</span>
                                <span className="text-white font-bold">{order.total.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/50">Thanh toán 100%</span>
                                <span className={order.deposit_paid ? 'text-green-400' : 'text-yellow-400'}>
                                    {order.deposit_amount.toLocaleString('vi-VN')}đ
                                    {!order.deposit_paid && ' (chưa TT)'}
                                </span>
                            </div>
                        </div>

                        {/* Confirm payment button */}
                        {order.status === 'pending' && !order.deposit_paid && (
                            <button
                                onClick={handleConfirmPayment}
                                disabled={saving}
                                className="w-full mt-4 py-3 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 disabled:opacity-50"
                            >
                                {saving ? 'Đang xử lý...' : '✓ Xác nhận đã thanh toán'}
                            </button>
                        )}
                    </motion.div>

                    {/* Shipping Code Input */}
                    {order.status === 'printing' && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                        >
                            <h3 className="text-lg font-semibold text-white mb-4">Mã vận đơn</h3>
                            <input
                                type="text"
                                value={shippingCode}
                                onChange={(e) => setShippingCode(e.target.value)}
                                placeholder="VTP123456789"
                                className="w-full p-3 bg-white/5 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                            />
                            <p className="text-white/40 text-xs mt-2">Nhập mã trước khi chuyển sang giao hàng</p>
                        </motion.div>
                    )}

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
                                disabled={saving || (nextStatus === 'shipping' && !shippingCode)}
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
