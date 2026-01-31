'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { getSupabase } from '@/lib/supabase/client';

interface OrderItem {
    id: string;
    product_name: string;
    product_sku: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    configuration: {
        size?: string;
    };
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
        name: string;
        phone: string;
        address: string;
        ward: string;
        district: string;
        province: string;
    } | null;
    shipping_code: string | null;
    customer_note: string | null;
    admin_note: string | null;
    created_at: string;
    paid_at: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    custom_config?: {
        type: string;
        size: string;
        images: { url: string; thumbnail: string }[];
        notes: string;
    };
    printing_config?: {
        type: string;
        color: string;
        quantity: number;
        analysis: { grams: number; hours: number; price: number };
        files: { url: string; name: string }[];
    };
    demo_image_url?: string;
    order_items: OrderItem[];
}

const statusLabels: Record<string, string> = {
    pending: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    processing: 'Đang sản xuất',
    designing: 'Đang thiết kế',
    review: 'Chờ xác nhận',
    approved: 'Đã duyệt',
    printing: 'Đang in',
    shipping: 'Đang giao hàng',
    delivered: 'Đã giao hàng',
    cancelled: 'Đã hủy',
};

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    paid: 'bg-emerald-500/20 text-emerald-400',
    processing: 'bg-blue-500/20 text-blue-400',
    designing: 'bg-purple-500/20 text-purple-400',
    review: 'bg-amber-500/20 text-amber-400',
    approved: 'bg-cyan-500/20 text-cyan-400',
    printing: 'bg-indigo-500/20 text-indigo-400',
    shipping: 'bg-orange-500/20 text-orange-400',
    delivered: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
};

const orderTypeLabels: Record<string, string> = {
    ready_made: 'Sản phẩm có sẵn',
    custom: 'Đặt theo yêu cầu',
    printing: 'Dịch vụ in 3D',
};

export default function AccountOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session, status } = useSession();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);

    // Handle customer review action (approve or reject)
    const handleReview = async (action: 'approve' | 'reject') => {
        if (!order) return;

        setSubmittingReview(true);
        try {
            const res = await fetch(`/api/orders/${order.id}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Refresh order to show new status
            await fetchOrder();
            alert(action === 'approve' ? 'Đã duyệt thiết kế!' : 'Đã gửi yêu cầu chỉnh sửa!');
        } catch (err) {
            alert('Lỗi: ' + (err as Error).message);
        } finally {
            setSubmittingReview(false);
        }
    };

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.email) {
            fetchOrder();
        } else if (status === 'unauthenticated') {
            router.push('/login?redirect=/account/orders');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, session, params.id]);

    const fetchOrder = async () => {
        if (!session?.user?.email) return;

        try {
            // Use API route to bypass RLS (API verifies ownership server-side)
            const res = await fetch(`/api/orders/${params.id}`);
            const response = await res.json();

            if (!res.ok) {
                setError(response.error?.message || response.error || 'Không tìm thấy đơn hàng');
                setLoading(false);
                return;
            }

            // API returns { success: true, data: order }
            const orderData = response.data || response;
            setOrder(orderData);
            setLoading(false);
        } catch (err) {
            setError((err as Error).message);
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleString('vi-VN');
    };

    const getTimeline = () => {
        if (!order) return [];

        const baseTimeline = [
            {
                status: 'ordered',
                label: 'Đặt hàng thành công',
                date: formatDate(order.created_at),
                completed: true
            },
        ];

        if (order.deposit_paid || order.paid_at) {
            baseTimeline.push({
                status: 'paid',
                label: order.order_type === 'printing' ? 'Đã thanh toán 100%' : 'Đã cọc 50%',
                date: formatDate(order.paid_at),
                completed: true,
            });
        }

        // Add type-specific steps
        if (order.order_type === 'custom') {
            baseTimeline.push(
                { status: 'designing', label: 'Đang thiết kế', date: '', completed: order.status === 'designing' || ['review', 'approved', 'processing', 'shipping', 'delivered'].includes(order.status) },
                { status: 'review', label: 'Chờ xác nhận ảnh', date: '', completed: ['review', 'approved', 'processing', 'shipping', 'delivered'].includes(order.status) },
            );
        }

        if (order.order_type === 'printing') {
            baseTimeline.push(
                { status: 'printing', label: 'Đang in', date: '', completed: ['printing', 'shipping', 'delivered'].includes(order.status) },
            );
        }

        baseTimeline.push(
            { status: 'processing', label: 'Đang sản xuất', date: '', completed: ['processing', 'shipping', 'delivered'].includes(order.status) },
            { status: 'shipping', label: 'Đang giao hàng', date: formatDate(order.shipped_at), completed: ['shipping', 'delivered'].includes(order.status) },
            { status: 'delivered', label: 'Đã giao hàng', date: formatDate(order.delivered_at), completed: order.status === 'delivered' },
        );

        return baseTimeline;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white/50">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="text-center py-20">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Không tìm thấy đơn hàng</h2>
                <p className="text-white/50 mb-6">{error}</p>
                <Link href="/account/orders" className="px-6 py-3 bg-white text-black rounded-xl font-medium">
                    Quay lại đơn hàng
                </Link>
            </div>
        );
    }

    const remaining = order.total - order.deposit_amount;
    const timeline = getTimeline();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/account/orders"
                        className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Đơn hàng {order.order_code}</h1>
                        <p className="text-white/50 mt-1">
                            {orderTypeLabels[order.order_type]} • {formatDate(order.created_at)}
                        </p>
                    </div>
                </div>
                <span className={`px-4 py-2 rounded-xl text-sm font-medium ${statusColors[order.status] || 'bg-gray-500/20 text-gray-400'}`}>
                    {statusLabels[order.status] || order.status}
                </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Timeline */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-6">Trạng thái đơn hàng</h2>
                        <div className="relative">
                            {timeline.map((step, index) => (
                                <div key={step.status} className="flex gap-4 pb-6 last:pb-0">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-4 h-4 rounded-full ${step.completed ? 'bg-white' : 'bg-white/20'}`} />
                                        {index < timeline.length - 1 && (
                                            <div className={`w-0.5 flex-1 ${step.completed ? 'bg-white/50' : 'bg-white/10'}`} />
                                        )}
                                    </div>
                                    <div className="flex-1 pb-2">
                                        <p className={`font-medium ${step.completed ? 'text-white' : 'text-white/40'}`}>
                                            {step.label}
                                        </p>
                                        {step.date && (
                                            <p className="text-white/50 text-sm">{step.date}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Order items - Ready Made */}
                    {order.order_type === 'ready_made' && order.order_items.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                        >
                            <h2 className="text-lg font-semibold text-white mb-4">Sản phẩm</h2>
                            <div className="space-y-4">
                                {order.order_items.map((item) => (
                                    <div key={item.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                                        <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                                            📦
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-white font-medium">{item.product_name}</p>
                                            <p className="text-white/50 text-sm">
                                                {item.configuration?.size || item.product_sku} × {item.quantity}
                                            </p>
                                        </div>
                                        <p className="text-white font-medium">{item.total_price.toLocaleString('vi-VN')}đ</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Custom Config */}
                    {order.order_type === 'custom' && order.custom_config && (
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
                                    <p className="text-white font-medium capitalize">{order.custom_config.type}</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl">
                                    <p className="text-white/50 text-sm">Kích thước</p>
                                    <p className="text-white font-medium">{order.custom_config.size}</p>
                                </div>
                            </div>
                            {order.custom_config.notes && (
                                <div className="p-4 bg-white/5 rounded-xl mb-4">
                                    <p className="text-white/50 text-sm">Ghi chú</p>
                                    <p className="text-white">{order.custom_config.notes}</p>
                                </div>
                            )}
                            {order.custom_config.images?.length > 0 && (
                                <div>
                                    <p className="text-white/50 text-sm mb-2">Ảnh tham khảo</p>
                                    <div className="grid grid-cols-3 gap-2">
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
                    )}

                    {/* Demo Image Review - For custom orders with demo image */}
                    {order.order_type === 'custom' && order.demo_image_url && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-2xl border border-cyan-500/30 p-6"
                        >
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                🎨 Thiết kế của bạn
                                {order.status === 'review' && (
                                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                                        Chờ duyệt
                                    </span>
                                )}
                                {order.status === 'approved' && (
                                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                                        Đã duyệt
                                    </span>
                                )}
                            </h2>

                            {/* Demo Image */}
                            <div className="mb-4">
                                <a href={order.demo_image_url} target="_blank" rel="noopener noreferrer">
                                    <img
                                        src={order.demo_image_url}
                                        alt="Thiết kế demo"
                                        className="w-full rounded-xl border border-white/20 hover:border-white/50 transition-all"
                                    />
                                </a>
                            </div>

                            {/* Review Actions - Only show when status is 'review' */}
                            {order.status === 'review' && (
                                <div className="space-y-3">
                                    <p className="text-white/70 text-sm text-center">
                                        Bạn có hài lòng với thiết kế này?
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleReview('approve')}
                                            disabled={submittingReview}
                                            className="flex-1 py-3 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                                        >
                                            {submittingReview ? 'Đang xử lý...' : '✓ Duyệt thiết kế'}
                                        </button>
                                        <button
                                            onClick={() => handleReview('reject')}
                                            disabled={submittingReview}
                                            className="flex-1 py-3 rounded-xl border border-amber-500/50 text-amber-400 font-medium hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                                        >
                                            Yêu cầu chỉnh sửa
                                        </button>
                                    </div>
                                    <p className="text-white/40 text-xs text-center">
                                        * Khi duyệt, đơn hàng sẽ được chuyển sang sản xuất
                                    </p>
                                </div>
                            )}

                            {/* Already approved message */}
                            {order.status === 'approved' && (
                                <p className="text-green-400 text-sm text-center">
                                    ✓ Bạn đã duyệt thiết kế này. Đơn hàng đang được sản xuất.
                                </p>
                            )}
                        </motion.div>
                    )}

                    {/* Printing Config */}
                    {order.order_type === 'printing' && order.printing_config && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                        >
                            <h2 className="text-lg font-semibold text-white mb-4">Chi tiết đơn In 3D</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="p-4 bg-white/5 rounded-xl">
                                    <p className="text-white/50 text-sm">Loại in</p>
                                    <p className="text-white font-medium uppercase">{order.printing_config.type}</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl">
                                    <p className="text-white/50 text-sm">Màu</p>
                                    <p className="text-white font-medium capitalize">{order.printing_config.color}</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl">
                                    <p className="text-white/50 text-sm">Số lượng</p>
                                    <p className="text-white font-medium">×{order.printing_config.quantity}</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl">
                                    <p className="text-white/50 text-sm">Khối lượng</p>
                                    <p className="text-white font-medium">{order.printing_config.analysis?.grams || 0}g</p>
                                </div>
                            </div>
                            {order.printing_config.files?.length > 0 && (
                                <div className="p-4 bg-white/5 rounded-xl">
                                    <p className="text-white/50 text-sm mb-2">File 3D</p>
                                    {order.printing_config.files.map((file, i) => (
                                        <a
                                            key={i}
                                            href={file.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-blue-400 hover:underline"
                                        >
                                            <span>📄</span>
                                            <span>{file.name}</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Tracking */}
                    {order.shipping_code && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                        >
                            <h2 className="text-lg font-semibold text-white mb-4">Theo dõi vận chuyển</h2>
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                                <div>
                                    <p className="text-white/50 text-sm">Mã vận đơn (Viettel Post)</p>
                                    <p className="text-white font-medium mt-1">{order.shipping_code}</p>
                                </div>
                                <a
                                    href={`https://viettelpost.vn/tra-cuu-hanh-trinh-don?code=${order.shipping_code}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
                                >
                                    Theo dõi
                                </a>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Shipping Address */}
                    {order.shipping_address && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                        >
                            <h2 className="text-lg font-semibold text-white mb-4">Địa chỉ giao hàng</h2>
                            <div className="space-y-2">
                                <p className="text-white">{order.shipping_address.name}</p>
                                <p className="text-white/70">{order.shipping_address.phone}</p>
                                <p className="text-white/50">
                                    {order.shipping_address.address}, {order.shipping_address.ward}, {order.shipping_address.district}, {order.shipping_address.province}
                                </p>
                            </div>
                        </motion.div>
                    )}

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
                                <span className="text-white/70">Tạm tính</span>
                                <span className="text-white">{(order.subtotal || order.total || 0).toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="border-t border-white/10 pt-3 flex justify-between">
                                <span className="text-white font-medium">Tổng cộng</span>
                                <span className="text-white font-bold">{(order.total || 0).toLocaleString('vi-VN')}đ</span>
                            </div>
                            {order.deposit_amount !== undefined && order.deposit_amount > 0 && (
                                <div className="flex justify-between text-green-400">
                                    <span>{order.order_type === 'printing' ? 'Đã thanh toán' : 'Đã cọc'}</span>
                                    <span>{(order.deposit_amount || 0).toLocaleString('vi-VN')}đ</span>
                                </div>
                            )}
                            {remaining > 0 && order.order_type !== 'printing' && (
                                <div className="flex justify-between text-yellow-400">
                                    <span>Còn lại</span>
                                    <span>{remaining.toLocaleString('vi-VN')}đ</span>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Customer Note */}
                    {order.customer_note && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.45 }}
                            className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                        >
                            <h2 className="text-lg font-semibold text-white mb-4">Ghi chú</h2>
                            <p className="text-white/70">{order.customer_note}</p>
                        </motion.div>
                    )}

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-3"
                    >
                        <a
                            href="https://zalo.me/0901234567"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full py-3 rounded-xl bg-white text-black font-medium text-center hover:bg-white/90 transition-colors"
                        >
                            Liên hệ hỗ trợ
                        </a>
                        {order.status === 'pending' && (
                            <button className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                                Hủy đơn hàng
                            </button>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
