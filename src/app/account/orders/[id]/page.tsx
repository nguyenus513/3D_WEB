'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { X, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    getCartStatusLabel,
    getItemStatusLabel,
    formatOrderDate,
    SHIPPING_PROVIDERS,
    type ShippingProvider
} from '@/lib/utils/orderStatus';
import { buildUserTimeline } from '@/lib/utils/orderFlows';

interface OrderItem {
    id: string;
    cart_order_code?: string;
    item_order_code?: string;
    product_name: string;
    product_sku: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    status?: string;
    production_status?: string;
    item_type?: string;
    custom_type?: string;
    custom_size?: string;
    configuration: {
        size?: string;
        type?: string;
        color?: string;
        fileName?: string;
        file_name?: string;
        grams?: number;
        infill?: string;
        layerHeight?: string;
        custom_type?: string;
    };

    is_custom?: boolean;
    custom_note?: string;
    preview_images?: string[];
    preview_status?: 'pending' | 'approved' | 'revising';
    shipping_provider?: string;
    tracking_code?: string;
    delivered_at?: string;
}

interface Order {
    id: string;
    order_code: string;
    cart_code?: string;
    order_type: 'product' | 'custom' | 'print_3d';
    status: string;
    subtotal: number;
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
    demo_images?: { url: string; label: string; uploaded_at: string }[];
    finished_images?: { url: string; label: string; uploaded_at: string }[];
    revision_count?: number;
    revision_feedback?: string;
    approved_at?: string;
    order_items: OrderItem[];
}

const statusLabels: Record<string, string> = {
    pending: 'Chờ thanh toán',
    pending_confirmation: 'Chờ xác nhận giao dịch',
    confirmed: 'Đã xác nhận',
    paid: 'Đã thanh toán',
    processing: 'Đang xử lý',
    designing: 'Đang thiết kế',
    review: 'Chờ duyệt thiết kế',
    revising: 'Đang chỉnh sửa',
    approved: 'Đã duyệt thiết kế',
    production_pending: 'Chờ sản xuất',
    producing: 'Đang sản xuất',
    finished: 'Hoàn thiện',
    printing: 'Đang in 3D',
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
    revising: 'bg-pink-500/20 text-pink-400',
    approved: 'bg-cyan-500/20 text-cyan-400',
    producing: 'bg-indigo-500/20 text-indigo-400',
    finished: 'bg-teal-500/20 text-teal-400',
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
            const res = await fetch(`/api/orders/lookup?id=${params.id}`, { cache: 'no-store' });
            const response = await res.json();

            if (!res.ok || !response.success) {
                setError(response.error?.message || response.error || 'Không tìm thấy đơn hàng');
                setLoading(false);
                return;
            }

            const data = response.data;
            const orderData: Order = {
                id: data.id,
                order_code: data.order_code,
                cart_code: data.cart_code,
                order_type: data.order_type || 'custom',
                status: data.status,
                subtotal: data.total,
                total: data.total,
                deposit_amount: data.deposit_amount || (
                    (data.order_type === 'custom' || data.order_type === 'mixed')
                        ? Math.round(data.total * 0.5)
                        : data.total
                ),
                deposit_paid: data.payment_status === 'paid' || data.payment_status === 'deposit_paid',
                shipping_address: data.shipping_address,
                shipping_code: null,
                customer_note: null,
                admin_note: null,
                created_at: data.created_at,
                paid_at: null,
                shipped_at: null,
                delivered_at: null,
                order_items: data.items || [],
                demo_image_url: data.demo_image_url,
                demo_images: data.demo_images || [],
                finished_images: data.finished_images || [],
                revision_count: data.revision_count || 0,
                revision_feedback: data.revision_feedback || null,
                approved_at: data.approved_at || null,
                custom_config: data.custom_config,
                printing_config: data.printing_config,
            };
            setOrder(orderData);
            setLoading(false);
        } catch (err) {
            setError((err as Error).message);
            setLoading(false);
        }
    };
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '';
        return formatOrderDate(dateStr);
    };

    const getTimeline = () => {
        if (!order) return [];

        return buildUserTimeline(order.order_type, order.status, {
            createdAt: order.created_at,
            deliveredAt: order.delivered_at || undefined,
            shippedAt: order.shipped_at || undefined,
            revisionCount: order.revision_count,
            formatDate,
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[var(--text-secondary)]">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="text-center py-20">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <X size={32} className="text-red-400" strokeWidth={2} />
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Không tìm thấy đơn hàng</h2>
                <p className="text-[var(--text-secondary)] mb-6">{error}</p>
                <Link href="/account/orders" className="px-6 py-3 bg-[var(--text-primary)] text-[var(--bg-void)] rounded-xl font-medium">
                    Quay lại đơn hàng
                </Link>
            </div>
        );
    }

    const remaining = order.total - order.deposit_amount;
    const timeline = getTimeline();

    return (
        <div className="space-y-8">
            {/* HEADER - Mã đơn hàng */}
            <div className="bg-[var(--material-panel)] rounded-3xl border border-[var(--border-color)] p-8">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-5">
                        <Link
                            href="/account/orders"
                            className="p-3 rounded-xl hover:bg-[var(--material-glass)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mt-1"
                        >
                            <ArrowLeft size={20} strokeWidth={2} />
                        </Link>
                        <div>
                            <p className="text-[var(--text-secondary)] text-sm font-medium mb-2">
                                Mã đơn hàng
                            </p>
                            <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] font-mono tracking-tight select-all cursor-text">
                                {order.cart_code || order.order_code.slice(-8).toUpperCase()}
                            </h1>
                            <p className="text-[var(--text-tertiary)] text-sm mt-4">
                                Đặt lúc: {formatDate(order.created_at)}
                            </p>
                        </div>
                    </div>
                    <span className={`px-5 py-2.5 rounded-full text-sm font-semibold ${statusColors[order.status] || 'bg-gray-500/20 text-gray-400'}`}>
                        {getCartStatusLabel(order.status)}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Timeline */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[var(--material-panel)]/60 rounded-2xl border border-[var(--border-color)] p-5"
                    >
                        <h2 className="text-base font-medium text-[var(--text-secondary)] mb-5">Tiến trình đơn hàng</h2>
                        <div className="relative">
                            {timeline.map((step, index) => (
                                <div key={step.status} className="flex gap-3 pb-5 last:pb-0">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-3 h-3 rounded-full ${step.completed ? 'bg-[var(--text-primary)]/80' : 'bg-[var(--text-primary)]/15'}`} />
                                        {index < timeline.length - 1 && (
                                            <div className={`w-0.5 flex-1 ${step.completed ? 'bg-[var(--text-primary)]/30' : 'bg-[var(--text-primary)]/8'}`} />
                                        )}
                                    </div>
                                    <div className="flex-1 pb-1">
                                        <p className={`text-sm font-medium ${step.completed ? 'text-[var(--text-primary)]/80' : 'text-[var(--text-tertiary)]'}`}>
                                            {step.label}
                                            {step.status === 'review' && order.status === 'review' && (
                                                <span className="inline-block w-1.5 h-1.5 bg-amber-400 rounded-full ml-2 animate-pulse" />
                                            )}
                                        </p>
                                        {step.date && (
                                            <p className="text-[var(--text-tertiary)] text-xs mt-0.5">{step.date}</p>
                                        )}
                                        {step.status === 'review' && order.status === 'review' && (
                                            <Link
                                                href={`/account/orders/${order.id}/demo`}
                                                className="inline-flex items-center gap-1.5 mt-2 px-4 py-1.5 bg-amber-500/15 text-amber-400 text-xs font-medium rounded-lg hover:bg-amber-500/25 transition-colors"
                                            >
                                                Xem Demo
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </Link>
                                        )}
                                        {step.status === 'review' && order.status === 'revising' && order.revision_feedback && (
                                            <p className="text-pink-400/60 text-xs mt-1 italic">
                                                &ldquo;{order.revision_feedback}&rdquo;
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* CHI TIẾT ĐƠN HÀNG */}
                    {order.order_items.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Chi tiết đơn hàng</h2>

                            <div className="space-y-6">
                                {order.order_items.map((item) => {
                                    const displayCode = item.cart_order_code ||
                                        (order.cart_code && item.item_order_code
                                            ? `${order.cart_code}_${item.item_order_code}`
                                            : `#${item.id.slice(0, 8).toUpperCase()}`);

                                    const itemType = item.item_type || order.order_type;
                                    const isCustom = item.is_custom || itemType === 'custom';
                                    const isPrinting = itemType === 'printing' || itemType === 'print' || itemType === 'print_3d';

                                    const itemStatus = item.production_status || item.status || 'waiting';
                                    const getStatusBadge = (status: string) => {
                                        const statusLabel = getItemStatusLabel(status);
                                        const colorMap: Record<string, string> = {
                                            'waiting': 'bg-gray-500/20 text-gray-300',
                                            'pending': 'bg-gray-500/20 text-gray-300',
                                            'designing': 'bg-violet-500/20 text-violet-300',
                                            'waiting_approval': 'bg-amber-500/20 text-amber-300',
                                            'preview_pending': 'bg-amber-500/20 text-amber-300',
                                            'producing': 'bg-blue-500/20 text-blue-300',
                                            'printing': 'bg-indigo-500/20 text-indigo-300',
                                            'ready_to_ship': 'bg-cyan-500/20 text-cyan-300',
                                            'shipping': 'bg-sky-500/20 text-sky-300',
                                            'delivered': 'bg-green-500/20 text-green-300',
                                            'completed': 'bg-emerald-500/20 text-emerald-300',
                                            'done': 'bg-emerald-500/20 text-emerald-300',
                                        };
                                        return { label: statusLabel, color: colorMap[status] || 'bg-gray-500/20 text-gray-300' };
                                    };
                                    const badge = getStatusBadge(itemStatus);
                                    const quantity = Number(item.quantity || 1);
                                    const unitPrice = Number(item.unit_price || 0);
                                    const itemTotal = Number(item.total_price || unitPrice * quantity || 0);

                                    return (
                                        <div
                                            key={item.id}
                                            className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] overflow-hidden"
                                        >
                                            {/* HEADER: Code + Badge */}
                                            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
                                                <code className="font-mono text-sm text-[var(--text-secondary)] tracking-wide select-all">
                                                    {displayCode}
                                                </code>
                                                <span className={`px-3 py-1.5 text-xs font-semibold rounded-full ${badge.color}`}>
                                                    {badge.label}
                                                </span>
                                            </div>

                                            {/* BODY */}
                                            <div className="px-6 py-5 space-y-4">
                                                {/* Product Name + Price */}
                                                <div>
                                                    <h3 className="text-[var(--text-primary)] font-medium text-base leading-relaxed">
                                                        {item.product_name || (isPrinting ? 'Đơn in 3D' : isCustom ? 'Đơn thiết kế riêng' : 'Sản phẩm')}
                                                    </h3>
                                                    <p className="text-[var(--text-primary)] font-semibold mt-1">
                                                        {(item.total_price || 0).toLocaleString('vi-VN')}đ
                                                    </p>
                                                </div>



                                                {/* Details list */}
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[var(--text-tertiary)]">•</span>
                                                        <span className="text-[var(--text-secondary)]">Số lượng:</span>
                                                        <span className="text-[var(--text-primary)]">{item.quantity}</span>
                                                    </div>

                                                    {item.configuration?.size && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[var(--text-tertiary)]">•</span>
                                                            <span className="text-[var(--text-secondary)]">Size:</span>
                                                            <span className="text-[var(--text-primary)]">{item.configuration.size}</span>
                                                        </div>
                                                    )}

                                                    {/* IN 3D: Hiển thị settings theo loại */}
                                                    {isPrinting && (() => {
                                                        const printType = item.configuration?.type?.toLowerCase();
                                                        const isFdm = printType === 'fdm';
                                                        return (
                                                            <>
                                                                {/* Print Type: FDM or Resin */}
                                                                {item.configuration?.type && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[var(--text-tertiary)]">•</span>
                                                                        <span className="text-[var(--text-secondary)]">Loại in:</span>
                                                                        <span className="text-[var(--text-primary)] uppercase font-medium">{item.configuration.type}</span>
                                                                    </div>
                                                                )}
                                                                {/* Color — all types */}
                                                                {item.configuration?.color && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[var(--text-tertiary)]">•</span>
                                                                        <span className="text-[var(--text-secondary)]">Màu:</span>
                                                                        <span className="text-[var(--text-primary)] capitalize">{item.configuration.color}</span>
                                                                    </div>
                                                                )}
                                                                {/* FDM-only: Infill */}
                                                                {isFdm && item.configuration?.infill && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[var(--text-tertiary)]">•</span>
                                                                        <span className="text-[var(--text-secondary)]">Infill:</span>
                                                                        <span className="text-[var(--text-primary)]">{item.configuration.infill}%</span>
                                                                    </div>
                                                                )}
                                                                {/* FDM-only: Layer Height */}
                                                                {isFdm && item.configuration?.layerHeight && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[var(--text-tertiary)]">•</span>
                                                                        <span className="text-[var(--text-secondary)]">Layer:</span>
                                                                        <span className="text-[var(--text-primary)]">{item.configuration.layerHeight}mm</span>
                                                                    </div>
                                                                )}
                                                                {/* File Name */}
                                                                {(item.configuration?.fileName || item.configuration?.file_name) && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[var(--text-tertiary)]">•</span>
                                                                        <span className="text-[var(--text-secondary)]">File:</span>
                                                                        <span className="text-[var(--text-primary)] truncate max-w-[200px]">
                                                                            {item.configuration.fileName || item.configuration.file_name}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {/* Weight */}
                                                                {item.configuration?.grams && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[var(--text-tertiary)]">•</span>
                                                                        <span className="text-[var(--text-secondary)]">Khối lượng:</span>
                                                                        <span className="text-[var(--text-primary)]">{item.configuration.grams}g</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}


                                                    {/* CUSTOM: Hiển thị loại custom */}
                                                    {isCustom && item.configuration?.custom_type && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[var(--text-tertiary)]">•</span>
                                                            <span className="text-[var(--text-secondary)]">Loại:</span>
                                                            <span className="text-[var(--text-primary)] capitalize">{item.configuration.custom_type}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* CUSTOM ORDER SECTION */}
                                                {isCustom && (
                                                    <div className="space-y-4 pt-2">
                                                        {/* Custom Note - User's request */}
                                                        {(item.custom_note || item.configuration?.custom_type) && (
                                                            <div className="p-4 bg-[var(--material-glass)] rounded-xl border border-[var(--border-color)]">
                                                                <p className="text-[var(--text-secondary)] text-xs font-medium mb-2 flex items-center gap-1.5">
                                                                    📝 Yêu cầu của bạn
                                                                </p>
                                                                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                                                                    {item.custom_note || `Loại: ${item.configuration?.custom_type || 'Custom'}, Size: ${item.configuration?.size || 'Chưa xác định'}`}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Preview Images - Admin sent */}
                                                        {item.preview_images && item.preview_images.length > 0 && (
                                                            <div className="p-4 bg-gradient-to-br from-cyan-500/[0.03] to-purple-500/[0.03] rounded-xl border border-cyan-500/10">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <p className="text-[var(--text-secondary)] text-xs font-medium flex items-center gap-1.5">
                                                                        📷 Preview thiết kế (Admin gửi)
                                                                    </p>
                                                                    {/* Preview Status Badge */}
                                                                    {item.preview_status === 'pending' && (
                                                                        <span className="px-2.5 py-1 bg-yellow-500/15 text-yellow-400 text-xs rounded-full font-medium">
                                                                            ⏳ Chờ bạn xác nhận
                                                                        </span>
                                                                    )}
                                                                    {item.preview_status === 'approved' && (
                                                                        <span className="px-2.5 py-1 bg-green-500/15 text-green-400 text-xs rounded-full font-medium">
                                                                            ✓ Đã duyệt
                                                                        </span>
                                                                    )}
                                                                    {item.preview_status === 'revising' && (
                                                                        <span className="px-2.5 py-1 bg-orange-500/15 text-orange-400 text-xs rounded-full font-medium">
                                                                            🔄 Đang chỉnh sửa
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-3">
                                                                    {item.preview_images.map((img, i) => (
                                                                        <a
                                                                            key={i}
                                                                            href={img}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="aspect-square rounded-xl bg-[var(--material-glass)] overflow-hidden hover:ring-2 ring-cyan-400/50 transition-all"
                                                                        >
                                                                            <img
                                                                                src={img}
                                                                                alt={`Preview ${i + 1}`}
                                                                                className="w-full h-full object-cover"
                                                                            />
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Footer - Only show tracking info */}
                                                {(item.shipping_provider || item.tracking_code || item.delivered_at) && (
                                                    <div className="pt-4 border-t border-[var(--border-color)] space-y-1">
                                                        {(item.shipping_provider || item.tracking_code) && (
                                                            <p className="text-sm text-[var(--text-secondary)]">
                                                                Mã vận chuyển: {item.shipping_provider && `${item.shipping_provider} - `}{item.tracking_code}
                                                            </p>
                                                        )}
                                                        {item.delivered_at && (
                                                            <p className="text-sm text-green-400">
                                                                Đã giao thành công
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* Custom Config */}
                    {order.order_type === 'custom' && order.custom_config && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6"
                        >
                            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Chi tiết đơn Custom</h2>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="p-4 bg-[var(--material-glass)] rounded-xl">
                                    <p className="text-[var(--text-secondary)] text-sm">Loại</p>
                                    <p className="text-[var(--text-primary)] font-medium capitalize">{order.custom_config.type}</p>
                                </div>
                                <div className="p-4 bg-[var(--material-glass)] rounded-xl">
                                    <p className="text-[var(--text-secondary)] text-sm">Kích thước</p>
                                    <p className="text-[var(--text-primary)] font-medium">{order.custom_config.size}</p>
                                </div>
                            </div>
                            {order.custom_config.notes && (
                                <div className="p-4 bg-[var(--material-glass)] rounded-xl mb-4">
                                    <p className="text-[var(--text-secondary)] text-sm">Ghi chú</p>
                                    <p className="text-[var(--text-primary)]">{order.custom_config.notes}</p>
                                </div>
                            )}
                            {order.custom_config.images?.length > 0 && (
                                <div>
                                    <p className="text-[var(--text-secondary)] text-sm mb-2">Ảnh tham khảo</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {order.custom_config.images.map((img, i) => (
                                            <a
                                                key={i}
                                                href={img.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="aspect-square rounded-xl bg-[var(--material-glass)] overflow-hidden hover:ring-2 ring-[var(--text-secondary)] transition-all"
                                            >
                                                {(!img.thumbnail?.includes('[object Object]') && !img.url?.includes('[object Object]')) && (
                                                    <img
                                                        src={img.thumbnail || img.url}
                                                        alt={`Ảnh ${i + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                )}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}



                    {/* FINISHED PRODUCT GALLERY */}
                    {order.order_type === 'custom' && order.finished_images && order.finished_images.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-gradient-to-br from-teal-500/10 to-emerald-500/10 rounded-2xl border border-teal-500/30 p-6"
                        >
                            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                ⭐ Sản phẩm hoàn thiện
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {order.finished_images.map((img, i) => (
                                    <a
                                        key={i}
                                        href={img.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group relative aspect-square rounded-xl bg-[var(--material-glass)] overflow-hidden hover:ring-2 ring-teal-400/50 transition-all"
                                    >
                                        <img src={img.url} alt={img.label || `Finished ${i + 1}`} className="w-full h-full object-cover" />
                                        {img.label && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                                                <p className="text-[var(--text-secondary)] text-xs truncate">{img.label}</p>
                                            </div>
                                        )}
                                    </a>
                                ))}
                            </div>
                        </motion.div>
                    )}



                    {/* Printing Config */}
                    {order.order_type === 'print_3d' && order.printing_config && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6"
                        >
                            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Chi tiết đơn In 3D</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="p-4 bg-[var(--material-glass)] rounded-xl">
                                    <p className="text-[var(--text-secondary)] text-sm">Loại in</p>
                                    <p className="text-[var(--text-primary)] font-medium uppercase">{order.printing_config.type}</p>
                                </div>
                                <div className="p-4 bg-[var(--material-glass)] rounded-xl">
                                    <p className="text-[var(--text-secondary)] text-sm">Màu</p>
                                    <p className="text-[var(--text-primary)] font-medium capitalize">{order.printing_config.color}</p>
                                </div>
                                <div className="p-4 bg-[var(--material-glass)] rounded-xl">
                                    <p className="text-[var(--text-secondary)] text-sm">Số lượng</p>
                                    <p className="text-[var(--text-primary)] font-medium">×{order.printing_config.quantity}</p>
                                </div>
                                <div className="p-4 bg-[var(--material-glass)] rounded-xl">
                                    <p className="text-[var(--text-secondary)] text-sm">Khối lượng</p>
                                    <p className="text-[var(--text-primary)] font-medium">{order.printing_config.analysis?.grams || 0}g</p>
                                </div>
                            </div>
                            {order.printing_config.files?.length > 0 && (
                                <div className="p-4 bg-[var(--material-glass)] rounded-xl">
                                    <p className="text-[var(--text-secondary)] text-sm mb-2">File 3D</p>
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


                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Shipping Address */}
                    {order.shipping_address && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6"
                        >
                            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Địa chỉ giao hàng</h2>
                            <div className="space-y-1">
                                <p className="text-[var(--text-primary)] font-medium">
                                    {(order.shipping_address as any).full_name || order.shipping_address.name}
                                </p>
                                <p className="text-[var(--text-secondary)]">{order.shipping_address.phone}</p>
                                <p className="text-[var(--text-secondary)] leading-relaxed">
                                    {[
                                        (order.shipping_address as any).address_line || order.shipping_address.address,
                                        (order.shipping_address as any).ward || order.shipping_address.ward,
                                        (order.shipping_address as any).district || order.shipping_address.district,
                                        (order.shipping_address as any).province || order.shipping_address.province || (order.shipping_address as any).city
                                    ].filter(Boolean).join(', ')}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Payment */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Thanh toán</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-[var(--text-secondary)]">Tạm tính</span>
                                <span className="text-[var(--text-primary)]">{(order.subtotal || order.total || 0).toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="border-t border-[var(--border-color)] pt-3 flex justify-between">
                                <span className="text-[var(--text-primary)] font-medium">Tổng cộng</span>
                                <span className="text-[var(--text-primary)] font-bold">{(order.total || 0).toLocaleString('vi-VN')}đ</span>
                            </div>
                            {order.deposit_amount !== undefined && order.deposit_amount > 0 && (
                                <div className="flex justify-between text-green-400">
                                    <span>{order.deposit_amount >= (order.total || 0) ? 'Đã thanh toán' : 'Đã cọc'}</span>
                                    <span>{(order.deposit_amount || 0).toLocaleString('vi-VN')}đ</span>
                                </div>
                            )}
                            {remaining > 0 && order.order_type !== 'print_3d' && (
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
                            className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6"
                        >
                            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Ghi chú</h2>
                            <p className="text-[var(--text-secondary)]">{order.customer_note}</p>
                        </motion.div>
                    )}

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] p-6 space-y-3"
                    >
                        <a
                            href="https://zalo.me/0901234567"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full py-3 rounded-xl bg-[var(--text-primary)] text-[var(--bg-void)] font-medium text-center hover:opacity-90 transition-colors"
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
