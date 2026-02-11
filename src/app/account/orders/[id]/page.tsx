'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { getSupabase } from '@/lib/supabase/client';
import { X, ArrowLeft } from 'lucide-react';
import {
    getCartStatusLabel,
    getItemStatusLabel,
    formatOrderDate,
    SHIPPING_PROVIDERS,
    type ShippingProvider
} from '@/lib/utils/orderStatus';

interface OrderItem {
    id: string;
    cart_order_code?: string; // 17 char format: CARTCODE_ORDERCODE
    item_order_code?: string; // 8 char format
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
        // Printing fields
        type?: string;
        color?: string;
        fileName?: string;
        file_name?: string;
        grams?: number;
        infill?: string; // FDM infill percentage
        layerHeight?: string; // FDM layer height
        // Custom fields
        custom_type?: string;
    };

    // Custom order fields
    is_custom?: boolean;
    custom_note?: string; // User's custom request description
    preview_images?: string[]; // Admin preview images URLs
    preview_status?: 'pending' | 'approved' | 'revising'; // Review status
    // Shipping fields (per-item tracking)
    shipping_provider?: string;
    tracking_code?: string;
    delivered_at?: string;
}

interface Order {
    id: string;
    order_code: string;
    cart_code?: string; // 8 HEX - primary display identifier
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
            // Use lookup API that searches across all order tables
            // Disable cache to ensure fresh status updates
            const res = await fetch(`/api/orders/lookup?id=${params.id}`, { cache: 'no-store' });
            const response = await res.json();

            if (!res.ok || !response.success) {
                setError(response.error?.message || response.error || 'Không tìm thấy đơn hàng');
                setLoading(false);
                return;
            }

            // Transform API response to match Order interface
            const data = response.data;
            const orderData: Order = {
                id: data.id,
                order_code: data.order_code,
                cart_code: data.cart_code, // 8 HEX display code
                order_type: data.order_type || 'custom',
                status: data.status,
                subtotal: data.total,
                shipping_fee: 0,
                total: data.total,
                // Calculate deposit based on order type: custom = 50%, others = 100%
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
                // CRITICAL: Include demo fields for review flow
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
    // Format date: DD/MM/YYYY HH:MM:SS (no icons)
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '';
        return formatOrderDate(dateStr);
    };

    const getTimeline = () => {
        if (!order) return [];

        const s = order.status;

        // ═══ CUSTOM ORDER TIMELINE (6 steps) ═══
        if (order.order_type === 'custom') {
            const customSteps = [
                { key: 'ordered', label: 'Đã đặt hàng', statuses: ['pending', 'confirmed'] },
                { key: 'designing', label: 'Đang thiết kế', statuses: ['designing', 'revising'] },
                { key: 'review', label: 'Chờ duyệt Demo', statuses: ['review'] },
                { key: 'producing', label: 'Đang sản xuất', statuses: ['approved', 'production_pending', 'producing'] },
                { key: 'finished', label: 'Hoàn thiện', statuses: ['finished'] },
                { key: 'delivered', label: 'Hoàn thành', statuses: ['shipping', 'delivered'] },
            ];

            // Find which step the current status belongs to
            let currentStepIndex = 0;
            for (let i = 0; i < customSteps.length; i++) {
                if (customSteps[i].statuses.includes(s)) {
                    currentStepIndex = i;
                    break;
                }
            }

            // Special: if delivered, all steps are complete
            if (s === 'delivered') currentStepIndex = customSteps.length - 1;

            return customSteps.map((step, idx) => {
                let date = '';
                if (idx === 0 && currentStepIndex >= 0) date = formatDate(order.created_at);
                if (step.key === 'review' && s === 'review') date = 'Chờ bạn duyệt';
                if (step.key === 'designing' && s === 'revising') date = 'Chỉnh sửa lần ' + (order.revision_count || 1);
                if (step.key === 'producing' && ['approved', 'producing'].includes(s)) date = 'Đang thực hiện';
                if (step.key === 'finished' && s === 'finished') date = 'Chờ giao hàng';
                if (step.key === 'delivered' && s === 'delivered') date = order.delivered_at ? formatDate(order.delivered_at) : '';
                if (step.key === 'delivered' && s === 'shipping') date = 'Đang giao';

                return {
                    status: step.key,
                    label: step.label,
                    date,
                    completed: idx <= currentStepIndex,
                };
            });
        }

        // ═══ DEFAULT TIMELINE (4 steps for ready_made / printing) ═══
        let currentLevel = 0;

        if (s === 'delivered') currentLevel = 4;
        else if (s === 'shipping') currentLevel = 3;
        else if (['processing', 'designing', 'review', 'approved', 'production_pending', 'producing', 'printing', 'revising', 'finished'].includes(s)) currentLevel = 2;
        else if (s === 'confirmed' || order.deposit_paid || (s !== 'pending' && s !== 'cancelled')) currentLevel = 1;

        const timeline = [
            {
                status: 'confirmed',
                label: 'Đã xác nhận',
                date: order.paid_at ? formatDate(order.paid_at) : (currentLevel >= 1 ? formatDate(order.created_at) : ''),
                completed: currentLevel >= 1
            },
            {
                status: 'processing',
                label: 'Đang xử lý',
                date: (currentLevel >= 2 && currentLevel < 3) ? 'Đang thực hiện' : '',
                completed: currentLevel >= 2
            },
            {
                status: 'shipping',
                label: 'Đang giao hàng',
                date: order.shipped_at ? formatDate(order.shipped_at) : '',
                completed: currentLevel >= 3
            },
            {
                status: 'delivered',
                label: 'Hoàn thành',
                date: order.delivered_at ? formatDate(order.delivered_at) : '',
                completed: currentLevel >= 4
            }
        ];

        return timeline;
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
                    <X size={32} className="text-red-400" strokeWidth={2} />
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
        <div className="space-y-8">
            {/* ═══════════════════════════════════════════════════════════════
                HEADER - Mã đơn hàng
            ═══════════════════════════════════════════════════════════════ */}
            <div className="bg-[#1D1D1F] rounded-3xl border border-white/10 p-8">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-5">
                        <Link
                            href="/account/orders"
                            className="p-3 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors mt-1"
                        >
                            <ArrowLeft size={20} strokeWidth={2} />
                        </Link>
                        <div>
                            <p className="text-white/50 text-sm font-medium mb-2">
                                Mã đơn hàng
                            </p>
                            <h1 className="text-4xl md:text-5xl font-bold text-white font-mono tracking-tight select-all cursor-text">
                                {order.cart_code || order.order_code.slice(-8).toUpperCase()}
                            </h1>
                            <p className="text-white/40 text-sm mt-4">
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
                    {/* Timeline - Supporting context, reduced visual weight */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#1a1a1c]/60 rounded-2xl border border-white/5 p-5"
                    >
                        <h2 className="text-base font-medium text-white/70 mb-5">Tiến trình đơn hàng</h2>
                        <div className="relative">
                            {timeline.map((step, index) => (
                                <div key={step.status} className="flex gap-3 pb-5 last:pb-0">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-3 h-3 rounded-full ${step.completed ? 'bg-white/80' : 'bg-white/15'}`} />
                                        {index < timeline.length - 1 && (
                                            <div className={`w-0.5 flex-1 ${step.completed ? 'bg-white/30' : 'bg-white/8'}`} />
                                        )}
                                    </div>
                                    <div className="flex-1 pb-1">
                                        <p className={`text-sm font-medium ${step.completed ? 'text-white/80' : 'text-white/30'}`}>
                                            {step.label}
                                        </p>
                                        {step.date && (
                                            <p className="text-white/40 text-xs mt-0.5">{step.date}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* ═══════════════════════════════════════════════════════════════
                        CHI TIẾT ĐƠN HÀNG - MAIN FOCUS AREA
                    ═══════════════════════════════════════════════════════════════ */}
                    {order.order_items.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <h2 className="text-lg font-semibold text-white mb-6">Chi tiết đơn hàng</h2>

                            {/* Order Cards - 24px spacing between cards */}
                            <div className="space-y-6">
                                {order.order_items.map((item) => {
                                    // Generate display code: CARTCODE_ITEMCODE
                                    const displayCode = item.cart_order_code ||
                                        (order.cart_code && item.item_order_code
                                            ? `${order.cart_code}_${item.item_order_code}`
                                            : `#${item.id.slice(0, 8).toUpperCase()}`);

                                    // Determine item type
                                    const itemType = item.item_type || order.order_type;
                                    const isCustom = item.is_custom || itemType === 'custom';
                                    const isPrinting = itemType === 'printing' || itemType === 'print';

                                    // Badge = item_status (trạng thái duy nhất của item)
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

                                    return (
                                        <div
                                            key={item.id}
                                            className="bg-[#1C1C1E] rounded-2xl border border-white/[0.06] overflow-hidden"
                                        >
                                            {/* ═══ HEADER: Code + Badge ═══ */}
                                            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                                                <code className="font-mono text-sm text-white/80 tracking-wide select-all">
                                                    {displayCode}
                                                </code>
                                                <span className={`px-3 py-1.5 text-xs font-semibold rounded-full ${badge.color}`}>
                                                    {badge.label}
                                                </span>
                                            </div>

                                            {/* ═══ BODY ═══ */}
                                            <div className="px-6 py-5 space-y-4">
                                                {/* Product Name + Price */}
                                                <div>
                                                    <h3 className="text-white font-medium text-base leading-relaxed">
                                                        {item.product_name || (isPrinting ? 'Đơn in 3D' : isCustom ? 'Đơn thiết kế riêng' : 'Sản phẩm')}
                                                    </h3>
                                                    <p className="text-white font-semibold mt-1">
                                                        {(item.total_price || 0).toLocaleString('vi-VN')}đ
                                                    </p>
                                                </div>



                                                {/* Details list */}
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white/40">•</span>
                                                        <span className="text-white/60">Số lượng:</span>
                                                        <span className="text-white">{item.quantity}</span>
                                                    </div>

                                                    {item.configuration?.size && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-white/40">•</span>
                                                            <span className="text-white/60">Size:</span>
                                                            <span className="text-white">{item.configuration.size}</span>
                                                        </div>
                                                    )}

                                                    {/* ═══ IN 3D: Hiển thị đầy đủ settings ═══ */}
                                                    {isPrinting && (
                                                        <>
                                                            {/* Print Type: FDM or Resin */}
                                                            {item.configuration?.type && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-white/40">•</span>
                                                                    <span className="text-white/60">Loại in:</span>
                                                                    <span className="text-white uppercase font-medium">{item.configuration.type}</span>
                                                                </div>
                                                            )}
                                                            {/* Color */}
                                                            {item.configuration?.color && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-white/40">•</span>
                                                                    <span className="text-white/60">Màu:</span>
                                                                    <span className="text-white capitalize">{item.configuration.color}</span>
                                                                </div>
                                                            )}
                                                            {/* FDM-specific: Infill */}
                                                            {item.configuration?.infill && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-white/40">•</span>
                                                                    <span className="text-white/60">Infill:</span>
                                                                    <span className="text-white">{item.configuration.infill}</span>
                                                                </div>
                                                            )}
                                                            {/* FDM-specific: Layer Height */}
                                                            {item.configuration?.layerHeight && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-white/40">•</span>
                                                                    <span className="text-white/60">Layer:</span>
                                                                    <span className="text-white">{item.configuration.layerHeight}</span>
                                                                </div>
                                                            )}
                                                            {/* File Name */}
                                                            {(item.configuration?.fileName || item.configuration?.file_name) && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-white/40">•</span>
                                                                    <span className="text-white/60">File:</span>
                                                                    <span className="text-white truncate max-w-[200px]">
                                                                        {item.configuration.fileName || item.configuration.file_name}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {/* Weight */}
                                                            {item.configuration?.grams && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-white/40">•</span>
                                                                    <span className="text-white/60">Khối lượng:</span>
                                                                    <span className="text-white">{item.configuration.grams}g</span>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}


                                                    {/* ═══ CUSTOM: Hiển thị loại custom ═══ */}
                                                    {isCustom && item.configuration?.custom_type && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-white/40">•</span>
                                                            <span className="text-white/60">Loại:</span>
                                                            <span className="text-white capitalize">{item.configuration.custom_type}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* ═══ CUSTOM ORDER SECTION ═══ */}
                                                {isCustom && (
                                                    <div className="space-y-4 pt-2">
                                                        {/* Custom Note - User's request */}
                                                        {(item.custom_note || item.configuration?.custom_type) && (
                                                            <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                                                                <p className="text-white/50 text-xs font-medium mb-2 flex items-center gap-1.5">
                                                                    📝 Yêu cầu của bạn
                                                                </p>
                                                                <p className="text-white/80 text-sm leading-relaxed">
                                                                    {item.custom_note || `Loại: ${item.configuration?.custom_type || 'Custom'}, Size: ${item.configuration?.size || 'Chưa xác định'}`}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Preview Images - Admin sent */}
                                                        {item.preview_images && item.preview_images.length > 0 && (
                                                            <div className="p-4 bg-gradient-to-br from-cyan-500/[0.03] to-purple-500/[0.03] rounded-xl border border-cyan-500/10">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <p className="text-white/50 text-xs font-medium flex items-center gap-1.5">
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
                                                                            className="aspect-square rounded-xl bg-white/5 overflow-hidden hover:ring-2 ring-cyan-400/50 transition-all"
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

                                                {/* Footer - Only show tracking info, no duplicate status */}
                                                {(item.shipping_provider || item.tracking_code || item.delivered_at) && (
                                                    <div className="pt-4 border-t border-white/[0.06] space-y-1">
                                                        {(item.shipping_provider || item.tracking_code) && (
                                                            <p className="text-sm text-white/60">
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

                    {/* ═══ DEMO STATUS BLOCK — CTA to dedicated review page ═══ */}
                    {order.order_type === 'custom' && (['review', 'revising', 'approved', 'producing', 'finished'].includes(order.status) || (order.demo_images && order.demo_images.length > 0)) && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className={`rounded-2xl border p-6 ${order.status === 'review'
                                ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30'
                                : order.status === 'revising'
                                    ? 'bg-gradient-to-br from-pink-500/10 to-purple-500/10 border-pink-500/20'
                                    : 'bg-[#1D1D1F] border-white/10'
                                }`}
                        >
                            {/* Review status — Prominent CTA */}
                            {order.status === 'review' && (
                                <div className="text-center space-y-4">
                                    <div className="w-12 h-12 mx-auto bg-amber-500/20 rounded-full flex items-center justify-center">
                                        <span className="text-2xl">🎨</span>
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-white">Demo đã sẵn sàng</h2>
                                        <p className="text-white/50 text-sm mt-1">Vui lòng xác nhận thiết kế để tiếp tục sản xuất</p>
                                    </div>
                                    <Link
                                        href={`/account/orders/${order.id}/demo`}
                                        className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-black font-semibold rounded-xl hover:bg-white/90 transition-all text-sm"
                                    >
                                        Xem Demo
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </Link>
                                </div>
                            )}

                            {/* Revising status — Waiting for new design */}
                            {order.status === 'revising' && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">✏️</span>
                                        <div>
                                            <h2 className="text-base font-semibold text-white">Đang chờ bản thiết kế mới</h2>
                                            <p className="text-white/40 text-xs">Lần chỉnh sửa: {order.revision_count || 1}</p>
                                        </div>
                                    </div>
                                    {order.revision_feedback && (
                                        <div className="p-3 bg-white/5 rounded-xl">
                                            <p className="text-white/30 text-xs mb-1">Phản hồi của bạn:</p>
                                            <p className="text-white/60 text-sm">{order.revision_feedback}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Approved status */}
                            {(['approved', 'producing', 'finished'].includes(order.status)) && (
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-green-400 text-lg">✓</span>
                                    </div>
                                    <div>
                                        <h2 className="text-base font-semibold text-white">Thiết kế đã được duyệt</h2>
                                        <p className="text-white/40 text-xs">Đơn hàng đang được sản xuất</p>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ═══ FINISHED PRODUCT GALLERY ═══ */}
                    {order.order_type === 'custom' && order.finished_images && order.finished_images.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-gradient-to-br from-teal-500/10 to-emerald-500/10 rounded-2xl border border-teal-500/30 p-6"
                        >
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                ⭐ Sản phẩm hoàn thiện
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {order.finished_images.map((img, i) => (
                                    <a
                                        key={i}
                                        href={img.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group relative aspect-square rounded-xl bg-white/5 overflow-hidden hover:ring-2 ring-teal-400/50 transition-all"
                                    >
                                        <img src={img.url} alt={img.label || `Finished ${i + 1}`} className="w-full h-full object-cover" />
                                        {img.label && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                                                <p className="text-white/80 text-xs truncate">{img.label}</p>
                                            </div>
                                        )}
                                    </a>
                                ))}
                            </div>
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
