'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase/client';
import { useAdminPath } from '@/hooks/useAdminPath';
import { OrderStatusStepper } from '@/components/admin/OrderStatusStepper';

interface CustomConfig {
    type?: 'single' | 'couple' | 'group';
    photos?: { drive_file_id: string; file_name: string; web_view_link?: string }[];
    style?: string;
    size?: string;
    demo_photo?: { drive_file_id: string; file_name: string; web_view_link?: string };
    customer_approved?: boolean;
}

interface PrintingConfig {
    stl_file?: { drive_file_id: string; file_name: string; web_view_link?: string };
    print_type?: 'FDM' | 'Resin';
    material?: string;
    color?: string;
    infill?: number;
    layer_height?: number;
}

interface OrderItem {
    id: string;
    product_id?: string;
    product_name: string;
    product_sku: string;
    product_image?: string;
    size: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    configuration?: CustomConfig | PrintingConfig | Record<string, unknown>;
}

interface Order {
    id: string;
    order_code: string;
    order_type: 'ready_made' | 'custom' | 'printing';
    status: string;
    subtotal: number;
    shipping_fee: number;
    total: number;
    deposit_amount: number;
    deposit_paid: boolean;
    shipping_address: {
        full_name: string;
        phone: string;
        address_line: string;
        ward?: string;
        district?: string;
        province: string;
    } | null;
    customer_note: string | null;
    admin_note: string | null;
    shipping_code: string | null;
    created_at: string;
    paid_at: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    profiles: {
        full_name: string;
        email: string;
        phone: string;
        customer_code: string;
    };
    order_items: OrderItem[];
    // Custom order config
    custom_config?: {
        type: string;
        size: string;
        notes?: string;
        images?: { id: string; name: string; url: string; thumbnail: string }[];
    };
    // Printing order config
    printing_config?: {
        type: string;
        color: string;
        quantity: number;
        analysis?: { grams: number; hours: number; price: number };
        files?: { url: string; name: string }[];
        notes?: string;
    };
    // Demo image for review
    demo_image_url?: string;
}

const statusLabels: Record<string, string> = {
    pending: 'Chờ thanh toán',
    pending_confirmation: 'Chờ Admin xác nhận TT',
    confirmed: 'Đã xác nhận TT',
    processing: 'Đang xử lý',
    designing: 'Đang thiết kế',
    review: 'Chờ xác nhận',
    revising: 'Đang chỉnh sửa',
    approved: 'Đã xác nhận',
    producing: 'Đang sản xuất',
    printing: 'Đang in',
    shipping: 'Đang giao hàng',
    delivered: 'Đã giao',
    cancelled: 'Đã hủy',
};

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    pending_confirmation: 'bg-orange-500/20 text-orange-400',
    confirmed: 'bg-green-500/20 text-green-400',
    processing: 'bg-blue-500/20 text-blue-400',
    designing: 'bg-purple-500/20 text-purple-400',
    review: 'bg-orange-500/20 text-orange-400',
    revising: 'bg-pink-500/20 text-pink-400',
    approved: 'bg-cyan-500/20 text-cyan-400',
    producing: 'bg-indigo-500/20 text-indigo-400',
    printing: 'bg-violet-500/20 text-violet-400',
    shipping: 'bg-amber-500/20 text-amber-400',
    delivered: 'bg-emerald-500/20 text-emerald-400',
    cancelled: 'bg-red-500/20 text-red-400',
};

// Statuses that trigger email notification
const emailTriggerStatuses = ['confirmed', 'review', 'approved', 'shipping'];

export default function AdminOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { adminRoot } = useAdminPath();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [trackingCode, setTrackingCode] = useState('');
    const [showTrackingModal, setShowTrackingModal] = useState(false);
    const [adminNote, setAdminNote] = useState('');
    const [uploadingDemo, setUploadingDemo] = useState(false);

    useEffect(() => {
        fetchOrder();
    }, [params.id]);

    const fetchOrder = async () => {
        try {
            // Use admin API to bypass RLS
            const res = await fetch(`/api/admin/orders/${params.id}`);
            const data = await res.json();

            if (data.error) {
                console.error('Error fetching order:', data.error);
                setLoading(false);
                return;
            }

            const orderData = data.order;
            const profileData = data.profile;

            // Map order items with proper structure
            const items = (orderData.order_items || []).map((item: {
                id: string;
                product_id?: string;
                product_name?: string;
                product_sku?: string;
                product_image?: string;
                quantity: number;
                unit_price: number;
                total_price: number;
                size?: string;
                configuration?: Record<string, unknown>;
            }) => ({
                ...item,
                product_name: item.product_name || 'Sản phẩm',
                product_sku: item.product_sku || '',
                size: item.size || '',
                product_image: item.product_image || null,
            }));

            // Get shipping address for fallback
            const shippingAddr = orderData.shipping_address as { full_name?: string; phone?: string } | null;

            setOrder({
                ...orderData,
                profiles: profileData ? {
                    full_name: profileData.full_name || shippingAddr?.full_name || 'Khách vãng lai',
                    email: profileData.email || '',
                    phone: profileData.phone || shippingAddr?.phone || '',
                    customer_code: profileData.customer_code || '',
                } : {
                    full_name: shippingAddr?.full_name || 'Khách vãng lai',
                    email: '',
                    phone: shippingAddr?.phone || '',
                    customer_code: '',
                },
                order_items: items,
            } as Order);
            setAdminNote(orderData.admin_note || '');
            setTrackingCode(orderData.shipping_code || '');
        } catch (error) {
            console.error('Error fetching order:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmPayment = async () => {
        if (!order) return;
        setUpdating(true);

        try {
            const res = await fetch(`/api/admin/orders/${order.id}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deposit_paid: true,
                    status: 'confirmed',
                    paid_at: new Date().toISOString(),
                }),
            });

            if (res.ok) {
                setOrder({ ...order, deposit_paid: true, status: 'confirmed' });

                // Auto-send confirmation email
                if (order.profiles?.email) {
                    await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'confirmed',
                            data: {
                                customerName: order.profiles.full_name || 'Khách hàng',
                                customerEmail: order.profiles.email,
                                orderCode: order.order_code,
                                orderType: order.order_type,
                                total: order.total,
                                depositAmount: order.deposit_amount,
                            },
                        }),
                    });
                }
            } else {
                const data = await res.json();
                console.error('Update failed:', data.error);
            }
        } catch (error) {
            console.error('Update error:', error);
        }
        setUpdating(false);
    };

    const handleUpdateStatus = async (newStatus: string) => {
        if (!order) return;
        setUpdating(true);

        const updates: Record<string, unknown> = { status: newStatus };
        const now = new Date().toISOString();

        // Save timestamp for each status
        const timestampMap: Record<string, string> = {
            confirmed: 'confirmed_at',
            processing: 'processing_at',
            designing: 'designing_at',
            review: 'review_at',
            revising: 'revising_at',
            approved: 'approved_at',
            producing: 'producing_at',
            printing: 'printing_at',
            shipping: 'shipped_at',
            delivered: 'delivered_at',
        };

        if (timestampMap[newStatus]) {
            updates[timestampMap[newStatus]] = now;
        }

        if (newStatus === 'shipping') {
            updates.shipping_code = trackingCode;
        }

        try {
            const res = await fetch(`/api/admin/orders/${order.id}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (res.ok) {
                setOrder({ ...order, status: newStatus, ...updates } as Order);
                setShowTrackingModal(false);

                // Auto-send email for trigger statuses
                if (emailTriggerStatuses.includes(newStatus) && order.profiles?.email) {
                    const emailData: Record<string, unknown> = {
                        customerName: order.profiles.full_name || 'Khách hàng',
                        customerEmail: order.profiles.email,
                        orderCode: order.order_code,
                    };

                    // Add specific data based on status
                    if (newStatus === 'shipping') {
                        emailData.shippingCode = trackingCode;
                    }
                    if (newStatus === 'approved') {
                        emailData.estimatedDays = 5;
                    }

                    await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: newStatus, data: emailData }),
                    });
                }
            } else {
                const data = await res.json();
                console.error('Update failed:', data.error);
            }
        } catch (error) {
            console.error('Update error:', error);
        }
        setUpdating(false);
    };

    const handleSaveNote = async () => {
        if (!order) return;
        try {
            await fetch(`/api/admin/orders/${order.id}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_note: adminNote }),
            });
        } catch (error) {
            console.error('Save note error:', error);
        }
    };

    // Upload demo image for customer review
    const handleUploadDemoImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!order || !e.target.files?.[0]) return;

        setUploadingDemo(true);
        try {
            const formData = new FormData();
            formData.append('file', e.target.files[0]);

            const res = await fetch(`/api/admin/orders/${order.id}/demo-image`, {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            // Refresh order to show new demo image and status
            await fetchOrder();
            alert('Upload thành công! Status đã chuyển sang "Chờ xác nhận"');
        } catch (error) {
            console.error('Demo upload error:', error);
            alert('Upload thất bại: ' + (error as Error).message);
        } finally {
            setUploadingDemo(false);
            // Reset input
            e.target.value = '';
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleString('vi-VN');
    };

    const getNextStatuses = () => {
        if (!order) return [];
        const currentStatus = order.status;

        if (order.order_type === 'ready_made') {
            const flow = ['pending', 'confirmed', 'processing', 'shipping', 'delivered'];
            const idx = flow.indexOf(currentStatus);
            return flow.slice(idx + 1);
        }
        if (order.order_type === 'custom') {
            const flow = ['pending', 'confirmed', 'designing', 'review', 'approved', 'producing', 'shipping', 'delivered'];
            const idx = flow.indexOf(currentStatus);
            return flow.slice(idx + 1);
        }
        if (order.order_type === 'printing') {
            const flow = ['pending', 'confirmed', 'printing', 'shipping', 'delivered'];
            const idx = flow.indexOf(currentStatus);
            return flow.slice(idx + 1);
        }
        return [];
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl text-white">Không tìm thấy đơn hàng</h2>
                <Link href={`${adminRoot}/orders`} className="text-blue-400 mt-4 inline-block">
                    ← Quay lại
                </Link>
            </div>
        );
    }

    const remaining = order.total - order.deposit_amount;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href={`${adminRoot}/orders`}
                        className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-white">{order.order_code}</h1>
                            <span className={`px-3 py-1 rounded-full text-sm ${statusColors[order.status]}`}>
                                {statusLabels[order.status]}
                            </span>
                        </div>
                        <p className="text-white/50 mt-1">Tạo lúc {formatDate(order.created_at)}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Payment Confirmation */}
                    {!order.deposit_paid && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-yellow-400 font-semibold">Chờ xác nhận thanh toán</h3>
                                    <p className="text-yellow-400/70 text-sm mt-1">
                                        Số tiền cọc: {order.deposit_amount.toLocaleString('vi-VN')}đ
                                    </p>
                                </div>
                                <button
                                    onClick={handleConfirmPayment}
                                    disabled={updating}
                                    className="px-6 py-2.5 rounded-xl bg-yellow-500 text-black font-medium hover:bg-yellow-400 disabled:opacity-50"
                                >
                                    {updating ? 'Đang xử lý...' : 'Xác nhận đã nhận tiền'}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Visual Progress Stepper */}
                    {order.deposit_paid && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                        >
                            <h2 className="text-lg font-semibold text-white mb-4">Tiến trình đơn hàng</h2>

                            {/* New Square Block Stepper */}
                            <OrderStatusStepper
                                orderType={order.order_type}
                                currentStatus={order.status}
                                onStatusChange={handleUpdateStatus}
                                onShippingClick={() => setShowTrackingModal(true)}
                                updating={updating}
                            />

                            {/* Demo Image Upload - For custom orders in designing/review status */}
                            {order.order_type === 'custom' && ['designing', 'processing', 'review', 'revising'].includes(order.status) && (
                                <div className="mt-6 pt-6 border-t border-white/10">
                                    <p className="text-white/50 text-sm mb-3">📷 Upload ảnh preview cho khách:</p>
                                    <label className={`
                                        flex items-center justify-center gap-2 px-4 py-3 rounded-xl 
                                        border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/50 
                                        bg-cyan-500/10 hover:bg-cyan-500/20 transition-all cursor-pointer
                                        ${uploadingDemo ? 'opacity-50 cursor-wait' : ''}
                                    `}>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleUploadDemoImage}
                                            disabled={uploadingDemo}
                                            className="hidden"
                                        />
                                        {uploadingDemo ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                                                <span className="text-cyan-400 text-sm">Đang upload...</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                </svg>
                                                <span className="text-cyan-400 text-sm font-medium">Chọn ảnh demo</span>
                                            </>
                                        )}
                                    </label>
                                    <p className="text-white/30 text-xs mt-2 text-center">
                                        Ảnh sẽ được gửi cho khách duyệt
                                    </p>
                                </div>
                            )}

                            {/* Current Demo Image Preview */}
                            {order.demo_image_url && (
                                <div className="mt-6 pt-6 border-t border-white/10">
                                    <p className="text-white/50 text-sm mb-3">🖼️ Ảnh demo hiện tại:</p>
                                    <a href={order.demo_image_url} target="_blank" rel="noopener noreferrer">
                                        <img
                                            src={order.demo_image_url}
                                            alt="Demo preview"
                                            className="w-full rounded-xl border border-white/10 hover:border-white/30 transition-all"
                                        />
                                    </a>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Order Items */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-4">
                            {order.order_type === 'custom' ? 'Chi tiết đơn Custom' :
                                order.order_type === 'printing' ? 'Chi tiết đơn In 3D' : 'Sản phẩm'}
                        </h2>
                        <div className="space-y-4">
                            {/* Custom Order - Show custom_config */}
                            {order.order_type === 'custom' && order.custom_config && (
                                <div className="space-y-3">
                                    {/* Row 1: Loại tranh */}
                                    <div className="flex items-center justify-between py-3 border-b border-white/10">
                                        <span className="text-white/60">Loại tranh</span>
                                        <span className="text-white font-medium">
                                            {order.custom_config.type === 'single' ? 'Cá nhân (1 người)' :
                                                order.custom_config.type === 'couple' ? 'Couple (2 người)' :
                                                    'Nhóm (3+ người)'}
                                        </span>
                                    </div>

                                    {/* Row 2: Kích thước */}
                                    <div className="flex items-center justify-between py-3 border-b border-white/10">
                                        <span className="text-white/60">Kích thước</span>
                                        <span className="text-white font-medium">
                                            {order.custom_config.size === 'S' ? 'S - 10cm' :
                                                order.custom_config.size === 'M' ? 'M - 15cm' :
                                                    order.custom_config.size === 'L' ? 'L - 20cm' :
                                                        order.custom_config.size === 'XL' ? 'XL - 25cm' :
                                                            order.custom_config.size || 'Chưa chọn'}
                                        </span>
                                    </div>

                                    {/* Row 3: Ghi chú */}
                                    <div className="py-3 border-b border-white/10">
                                        <p className="text-white/60 mb-2">Ghi chú của khách</p>
                                        <p className="text-white">
                                            {order.custom_config.notes || '—'}
                                        </p>
                                    </div>

                                    {/* Row 4: Ảnh tham khảo */}
                                    <div className="py-3">
                                        <p className="text-white/60 mb-2">
                                            Ảnh tham khảo ({order.custom_config.images?.length || 0} ảnh)
                                        </p>
                                        {order.custom_config.images && order.custom_config.images.length > 0 ? (
                                            <div className="space-y-2">
                                                {order.custom_config.images.map((img, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={img.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-3 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                                                    >
                                                        <img
                                                            src={img.thumbnail || img.url}
                                                            alt={img.name}
                                                            className="w-12 h-12 object-cover rounded"
                                                        />
                                                        <span className="text-white text-sm flex-1 truncate">
                                                            {img.name || `Ảnh ${idx + 1}`}
                                                        </span>
                                                        <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                    </a>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-white/40">—</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Printing Order - Show printing_config */}
                            {order.order_type === 'printing' && order.printing_config && (
                                <div className="space-y-4">
                                    {/* Section 1: Options đã chọn */}
                                    <div className="p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl border border-orange-500/20">
                                        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                                            <span className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center text-xs">1</span>
                                            Thông số in 3D
                                        </h3>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="p-3 bg-white/5 rounded-lg">
                                                <p className="text-white/50 text-xs mb-1">Công nghệ</p>
                                                <p className="text-white font-medium">
                                                    {order.printing_config.type === 'fdm' ? '🔧 FDM' : '✨ Resin'}
                                                </p>
                                            </div>
                                            <div className="p-3 bg-white/5 rounded-lg">
                                                <p className="text-white/50 text-xs mb-1">Màu sắc</p>
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="w-4 h-4 rounded-full border border-white/30"
                                                        style={{ backgroundColor: order.printing_config.color }}
                                                    />
                                                    <p className="text-white font-medium capitalize">{order.printing_config.color}</p>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white/5 rounded-lg">
                                                <p className="text-white/50 text-xs mb-1">Số lượng</p>
                                                <p className="text-white font-medium">{order.printing_config.quantity} sản phẩm</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: Phân tích file */}
                                    {order.printing_config.analysis && (
                                        <div className="p-4 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl border border-blue-500/20">
                                            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                                                <span className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-xs">2</span>
                                                Phân tích & Ước tính
                                            </h3>
                                            <div className="grid grid-cols-4 gap-3">
                                                <div className="p-3 bg-white/5 rounded-lg text-center">
                                                    <p className="text-white/50 text-xs mb-1">Trọng lượng</p>
                                                    <p className="text-white font-bold text-lg">{order.printing_config.analysis.grams}g</p>
                                                </div>
                                                <div className="p-3 bg-white/5 rounded-lg text-center">
                                                    <p className="text-white/50 text-xs mb-1">Thời gian in</p>
                                                    <p className="text-white font-bold text-lg">{order.printing_config.analysis.hours}h</p>
                                                </div>
                                                <div className="p-3 bg-white/5 rounded-lg text-center">
                                                    <p className="text-white/50 text-xs mb-1">Đơn giá</p>
                                                    <p className="text-white font-bold text-lg">{order.printing_config.analysis.price.toLocaleString('vi-VN')}đ</p>
                                                </div>
                                                <div className="p-3 bg-emerald-500/10 rounded-lg text-center border border-emerald-500/30">
                                                    <p className="text-emerald-400/70 text-xs mb-1">Tổng tiền</p>
                                                    <p className="text-emerald-400 font-bold text-lg">
                                                        {(order.printing_config.analysis.price * order.printing_config.quantity).toLocaleString('vi-VN')}đ
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Section 3: Files STL */}
                                    <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-teal-500/10 rounded-xl border border-cyan-500/20">
                                        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                                            <span className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center text-xs">3</span>
                                            File 3D (STL/OBJ)
                                            {order.printing_config.files && (
                                                <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full ml-auto">
                                                    {order.printing_config.files.length} file
                                                </span>
                                            )}
                                        </h3>
                                        {order.printing_config.files && order.printing_config.files.length > 0 ? (
                                            <div className="space-y-2">
                                                {order.printing_config.files.map((file, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={file.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group"
                                                    >
                                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center">
                                                            <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                            </svg>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-white font-medium truncate">{file.name}</p>
                                                            <p className="text-white/40 text-xs">File 3D • Click để tải xuống</p>
                                                        </div>
                                                        <svg className="w-5 h-5 text-white/40 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                        </svg>
                                                    </a>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-white/40 italic">Chưa có file</p>
                                        )}
                                    </div>

                                    {/* Section 4: Ghi chú (if exists) */}
                                    {order.printing_config.notes && (
                                        <div className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/20">
                                            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                                                <span className="w-6 h-6 bg-amber-500/20 rounded-full flex items-center justify-center text-xs">4</span>
                                                Ghi chú của khách
                                            </h3>
                                            <div className="p-3 bg-white/5 rounded-lg">
                                                <p className="text-white whitespace-pre-wrap">{order.printing_config.notes}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Ready Made Order - Show order_items */}
                            {order.order_type === 'ready_made' && (!order.order_items || order.order_items.length === 0) && (
                                <div className="p-8 text-center">
                                    <svg className="w-12 h-12 mx-auto text-white/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                    <p className="text-white/40">Không có sản phẩm trong đơn hàng này</p>
                                </div>
                            )}

                            {order.order_items && order.order_items.length > 0 && order.order_items.map((item) => {
                                const config = item.configuration as CustomConfig | PrintingConfig | undefined;
                                const isCustom = order.order_type === 'custom';
                                const isPrinting = order.order_type === 'printing';
                                const customConfig = isCustom ? config as CustomConfig : null;
                                const printingConfig = isPrinting ? config as PrintingConfig : null;

                                return (
                                    <div key={item.id} className="p-4 bg-white/5 rounded-xl space-y-4">
                                        {/* Main product info */}
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
                                                {item.product_image ? (
                                                    <img
                                                        src={item.product_image}
                                                        alt={item.product_name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                        }}
                                                    />
                                                ) : null}
                                                <div className={`w-full h-full flex items-center justify-center ${item.product_image ? 'hidden' : ''}`}>
                                                    <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-medium truncate">{item.product_name}</p>
                                                <p className="text-white/50 text-sm">
                                                    {item.product_sku} • {item.size} × {item.quantity}
                                                </p>
                                                <p className="text-white/40 text-xs mt-1">
                                                    {item.unit_price.toLocaleString('vi-VN')}đ/sp
                                                </p>
                                            </div>
                                            <p className="text-white font-medium">{item.total_price.toLocaleString('vi-VN')}đ</p>
                                        </div>

                                        {/* Custom Order: Photo uploads & style */}
                                        {isCustom && customConfig && (
                                            <div className="pt-4 border-t border-white/10 space-y-3">
                                                {/* Style & Type */}
                                                <div className="flex flex-wrap gap-2">
                                                    {customConfig.type && (
                                                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                                                            {customConfig.type === 'single' ? '1 người' : customConfig.type === 'couple' ? 'Couple' : 'Nhóm'}
                                                        </span>
                                                    )}
                                                    {customConfig.style && (
                                                        <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                                                            {customConfig.style}
                                                        </span>
                                                    )}
                                                    {customConfig.size && (
                                                        <span className="px-2 py-1 bg-white/10 text-white/60 text-xs rounded-full">
                                                            Size: {customConfig.size}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Uploaded photos */}
                                                {customConfig.photos && customConfig.photos.length > 0 && (
                                                    <div>
                                                        <p className="text-white/50 text-xs mb-2">📸 Ảnh khách gửi ({customConfig.photos.length})</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {customConfig.photos.map((photo, idx) => (
                                                                <a
                                                                    key={idx}
                                                                    href={photo.web_view_link || `https://drive.google.com/file/d/${photo.drive_file_id}/view`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="w-16 h-16 rounded-lg overflow-hidden bg-white/10 hover:ring-2 hover:ring-cyan-500 transition-all"
                                                                >
                                                                    <img
                                                                        src={`https://lh3.googleusercontent.com/d/${photo.drive_file_id}=w200`}
                                                                        alt={photo.file_name}
                                                                        className="w-full h-full object-cover"
                                                                        onError={(e) => {
                                                                            e.currentTarget.src = '';
                                                                            e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-white/30"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>';
                                                                        }}
                                                                    />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Demo photo if approved */}
                                                {customConfig.demo_photo && (
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <p className="text-white/50 text-xs">🎨 Demo</p>
                                                            {customConfig.customer_approved && (
                                                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">✓ Đã duyệt</span>
                                                            )}
                                                        </div>
                                                        <a
                                                            href={customConfig.demo_photo.web_view_link || `https://drive.google.com/file/d/${customConfig.demo_photo.drive_file_id}/view`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-block w-24 h-24 rounded-lg overflow-hidden bg-white/10 hover:ring-2 hover:ring-emerald-500 transition-all"
                                                        >
                                                            <img
                                                                src={`https://lh3.googleusercontent.com/d/${customConfig.demo_photo.drive_file_id}=w200`}
                                                                alt="Demo"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Printing Order: STL file & specs */}
                                        {isPrinting && printingConfig && (
                                            <div className="pt-4 border-t border-white/10 space-y-3">
                                                {/* Print specs */}
                                                <div className="flex flex-wrap gap-2">
                                                    {printingConfig.print_type && (
                                                        <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full">
                                                            {printingConfig.print_type}
                                                        </span>
                                                    )}
                                                    {printingConfig.material && (
                                                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                                                            {printingConfig.material}
                                                        </span>
                                                    )}
                                                    {printingConfig.color && (
                                                        <span className="px-2 py-1 bg-white/10 text-white/60 text-xs rounded-full flex items-center gap-1">
                                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: printingConfig.color.toLowerCase() }}></span>
                                                            {printingConfig.color}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Technical specs */}
                                                {(printingConfig.infill || printingConfig.layer_height) && (
                                                    <div className="flex gap-4 text-xs text-white/50">
                                                        {printingConfig.infill && <span>Infill: {printingConfig.infill}%</span>}
                                                        {printingConfig.layer_height && <span>Layer: {printingConfig.layer_height}mm</span>}
                                                    </div>
                                                )}

                                                {/* STL File */}
                                                {printingConfig.stl_file && (
                                                    <a
                                                        href={printingConfig.stl_file.web_view_link || `https://drive.google.com/file/d/${printingConfig.stl_file.drive_file_id}/view`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                                                    >
                                                        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                                            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                            </svg>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-white text-sm truncate">{printingConfig.stl_file.file_name}</p>
                                                            <p className="text-white/40 text-xs">File STL • Click để xem</p>
                                                        </div>
                                                        <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
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
                            onBlur={handleSaveNote}
                            placeholder="Ghi chú nội bộ..."
                            className="w-full p-4 bg-[#0a0a0a] rounded-xl text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-white/20 border border-white/10"
                            rows={3}
                        />
                    </motion.div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Customer Info - Full Details */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">Thông tin khách hàng</h2>
                            {order.profiles?.customer_code && (
                                <span className="text-xs bg-white/10 text-white/70 px-2 py-1 rounded-full font-mono">
                                    {order.profiles.customer_code}
                                </span>
                            )}
                        </div>

                        {/* Profile Info */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium truncate">
                                        {order.profiles?.full_name || order.shipping_address?.full_name || order.profiles?.email?.split('@')[0] || 'Khách hàng'}
                                    </p>
                                    <p className="text-white/50 text-sm">Khách hàng</p>
                                </div>
                            </div>

                            {/* Contact Details */}
                            <div className="grid gap-3">
                                {order.profiles?.email && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-white/50 text-xs">Email</p>
                                            <p className="text-white text-sm">{order.profiles.email}</p>
                                        </div>
                                    </div>
                                )}

                                {(order.profiles?.phone || order.shipping_address?.phone) && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-white/50 text-xs">Số điện thoại</p>
                                            <p className="text-white text-sm">{order.profiles?.phone || order.shipping_address?.phone}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>

                    {/* Shipping Address */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <h2 className="text-lg font-semibold text-white">Địa chỉ giao hàng</h2>
                        </div>
                        {order.shipping_address ? (
                            <div className="space-y-2">
                                <p className="text-white font-medium">{order.shipping_address.full_name}</p>
                                <p className="text-white/70">{order.shipping_address.phone}</p>
                                <p className="text-white/50 text-sm">
                                    {order.shipping_address.address_line}
                                    {order.shipping_address.ward && `, ${order.shipping_address.ward}`}
                                    {order.shipping_address.district && `, ${order.shipping_address.district}`}
                                    , {order.shipping_address.province}
                                </p>
                            </div>
                        ) : (
                            <p className="text-white/50">Chưa có địa chỉ</p>
                        )}
                        {order.shipping_code && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                    <p className="text-white/70 text-sm">Mã vận đơn</p>
                                </div>
                                <p className="text-white font-mono text-lg mt-1">{order.shipping_code}</p>
                            </div>
                        )}
                    </motion.div>

                    {/* Payment */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-4">Thanh toán</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-white/70">Tổng sản phẩm</span>
                                <span className="text-white">{order.subtotal.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/70">Phí ship</span>
                                <span className="text-white">{order.shipping_fee.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="border-t border-white/10 pt-3 flex justify-between">
                                <span className="text-white font-medium">Tổng cộng</span>
                                <span className="text-white font-bold">{order.total.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className={`flex justify-between ${order.deposit_paid ? 'text-green-400' : 'text-yellow-400'}`}>
                                <span>Tiền cọc {order.deposit_paid ? '(đã nhận)' : '(chờ)'}</span>
                                <span>{order.deposit_amount.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex justify-between text-white/50">
                                <span>Còn lại (COD)</span>
                                <span>{remaining.toLocaleString('vi-VN')}đ</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Customer Note */}
                    {order.customer_note && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                        >
                            <h2 className="text-lg font-semibold text-white mb-4">Ghi chú khách</h2>
                            <p className="text-white/70">{order.customer_note}</p>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Tracking Modal */}
            {showTrackingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-xl font-bold text-white mb-4">Nhập mã vận đơn</h2>
                        <input
                            type="text"
                            value={trackingCode}
                            onChange={(e) => setTrackingCode(e.target.value)}
                            placeholder="VD: VTP123456789"
                            className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleUpdateStatus('shipping')}
                                disabled={updating || !trackingCode}
                                className="flex-1 py-3 rounded-xl bg-white text-black font-medium disabled:opacity-50"
                            >
                                {updating ? 'Đang xử lý...' : 'Xác nhận'}
                            </button>
                            <button
                                onClick={() => setShowTrackingModal(false)}
                                className="px-6 py-3 rounded-xl border border-white/20 text-white/70"
                            >
                                Hủy
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
