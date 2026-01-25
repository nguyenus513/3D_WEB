'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase/client';
import { useAdminPath } from '@/hooks/useAdminPath';

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
}

const statusLabels: Record<string, string> = {
    pending: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    processing: 'Đang sản xuất',
    designing: 'Đang thiết kế',
    review: 'Chờ xác nhận',
    approved: 'Đã xác nhận',
    printing: 'Đang in',
    shipping: 'Đang giao',
    delivered: 'Đã giao',
    cancelled: 'Đã hủy',
};

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    paid: 'bg-green-500/20 text-green-400',
    processing: 'bg-blue-500/20 text-blue-400',
    designing: 'bg-purple-500/20 text-purple-400',
    review: 'bg-orange-500/20 text-orange-400',
    approved: 'bg-cyan-500/20 text-cyan-400',
    printing: 'bg-indigo-500/20 text-indigo-400',
    shipping: 'bg-orange-500/20 text-orange-400',
    delivered: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
};

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
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                }),
            });

            if (res.ok) {
                setOrder({ ...order, deposit_paid: true, status: 'paid' });
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
            processing: 'processing_at',
            designing: 'designing_at',
            review: 'review_at',
            approved: 'approved_at',
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

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleString('vi-VN');
    };

    const getNextStatuses = () => {
        if (!order) return [];
        const currentStatus = order.status;

        if (order.order_type === 'ready_made') {
            const flow = ['pending', 'paid', 'processing', 'shipping', 'delivered'];
            const idx = flow.indexOf(currentStatus);
            return flow.slice(idx + 1);
        }
        if (order.order_type === 'custom') {
            const flow = ['pending', 'paid', 'designing', 'review', 'approved', 'printing', 'shipping', 'delivered'];
            const idx = flow.indexOf(currentStatus);
            return flow.slice(idx + 1);
        }
        if (order.order_type === 'printing') {
            const flow = ['pending', 'paid', 'printing', 'shipping', 'delivered'];
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
                            <h2 className="text-lg font-semibold text-white mb-6">Tiến trình đơn hàng</h2>

                            {/* Progress Steps */}
                            {(() => {
                                const flows: Record<string, string[]> = {
                                    ready_made: ['paid', 'processing', 'shipping', 'delivered'],
                                    custom: ['paid', 'designing', 'review', 'approved', 'printing', 'shipping', 'delivered'],
                                    printing: ['paid', 'printing', 'shipping', 'delivered'],
                                };
                                const stepLabels: Record<string, string> = {
                                    paid: 'Thanh toán',
                                    processing: 'Xử lý',
                                    designing: 'Thiết kế',
                                    review: 'Chờ duyệt',
                                    approved: 'Đã duyệt',
                                    printing: 'Đang in',
                                    shipping: 'Giao hàng',
                                    delivered: 'Hoàn thành',
                                };
                                const timestampFields: Record<string, string> = {
                                    paid: 'paid_at',
                                    processing: 'processing_at',
                                    designing: 'designing_at',
                                    review: 'review_at',
                                    approved: 'approved_at',
                                    printing: 'printing_at',
                                    shipping: 'shipped_at',
                                    delivered: 'delivered_at',
                                };
                                const flow = flows[order.order_type] || flows.ready_made;
                                const currentIdx = flow.indexOf(order.status);

                                const formatTimestamp = (ts: string | null | undefined) => {
                                    if (!ts) return '';
                                    const d = new Date(ts);
                                    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                                };

                                // Flat SVG icons
                                const StepIcon = ({ step, isCompleted, isCurrent }: { step: string; isCompleted: boolean; isCurrent: boolean }) => {
                                    const iconClass = `w-5 h-5 ${isCompleted ? 'text-white' : isCurrent ? 'text-white' : 'text-white/40'}`;

                                    if (isCompleted) {
                                        return (
                                            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        );
                                    }

                                    const icons: Record<string, React.ReactNode> = {
                                        paid: <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>,
                                        processing: <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
                                        designing: <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg>,
                                        review: <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
                                        approved: <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                                        printing: <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>,
                                        shipping: <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>,
                                        delivered: <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>,
                                    };
                                    return icons[step] || icons.paid;
                                };

                                return (
                                    <div className="pt-2">
                                        {/* Steps row */}
                                        <div className="flex justify-between items-start relative">
                                            {flow.map((step, idx) => {
                                                const isCompleted = idx < currentIdx;
                                                const isCurrent = idx === currentIdx;
                                                const isNext = idx === currentIdx + 1;
                                                const timestampField = timestampFields[step];
                                                const timestamp = timestampField ? (order as unknown as Record<string, string | null>)[timestampField] : null;

                                                return (
                                                    <div key={step} className="flex flex-col items-center relative" style={{ width: `${100 / flow.length}%` }}>
                                                        {/* Connector line - only between icons */}
                                                        {idx < flow.length - 1 && (
                                                            <div
                                                                className={`absolute top-5 left-1/2 h-0.5 transition-all duration-300 ${isCompleted ? 'bg-gradient-to-r from-emerald-500 to-emerald-500' :
                                                                    isCurrent ? 'bg-gradient-to-r from-cyan-500 to-white/10' :
                                                                        'bg-white/10'
                                                                    }`}
                                                                style={{ width: '100%' }}
                                                            />
                                                        )}

                                                        {/* Icon button */}
                                                        <button
                                                            onClick={() => {
                                                                if (isNext) {
                                                                    if (step === 'shipping') {
                                                                        setShowTrackingModal(true);
                                                                    } else {
                                                                        handleUpdateStatus(step);
                                                                    }
                                                                }
                                                            }}
                                                            disabled={!isNext || updating}
                                                            className={`
                                                                w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 relative z-10
                                                                ${isCompleted ? 'bg-[#1D1D1F] border-2 border-emerald-500' : ''}
                                                                ${isCurrent ? 'bg-[#1D1D1F] border-2 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)]' : ''}
                                                                ${isNext ? 'bg-[#1D1D1F] border border-white/30 hover:border-white/60 cursor-pointer hover:scale-110' : ''}
                                                                ${!isCompleted && !isCurrent && !isNext ? 'bg-[#1D1D1F] border border-white/10' : ''}
                                                                ${updating && isNext ? 'opacity-50 cursor-wait' : ''}
                                                            `}
                                                        >
                                                            <StepIcon step={step} isCompleted={isCompleted} isCurrent={isCurrent} />
                                                        </button>

                                                        {/* Label */}
                                                        <span className={`mt-3 text-xs text-center font-medium ${isCompleted ? 'text-emerald-400' : isCurrent ? 'text-cyan-400' : 'text-white/40'}`}>
                                                            {stepLabels[step]}
                                                        </span>

                                                        {/* Timestamp or action hint */}
                                                        {(isCompleted || isCurrent) && timestamp && (
                                                            <span className="text-[10px] text-white/30 mt-0.5">{formatTimestamp(timestamp)}</span>
                                                        )}
                                                        {isNext && (
                                                            <span className="text-[10px] text-cyan-400/60 mt-0.5 font-medium">Click →</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Quick Action Buttons */}
                            {getNextStatuses().length > 0 && (
                                <div className="mt-6 pt-6 border-t border-white/10">
                                    <p className="text-white/50 text-sm mb-3">Hoặc chọn nhanh:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {getNextStatuses().map((status) => (
                                            <button
                                                key={status}
                                                onClick={() => {
                                                    if (status === 'shipping') {
                                                        setShowTrackingModal(true);
                                                    } else {
                                                        handleUpdateStatus(status);
                                                    }
                                                }}
                                                disabled={updating}
                                                className={`
                                                    flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50
                                                    ${status === 'delivered' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : ''}
                                                    ${status === 'shipping' ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : ''}
                                                    ${status === 'printing' ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : ''}
                                                    ${status === 'designing' ? 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30' : ''}
                                                    ${status === 'review' ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' : ''}
                                                    ${status === 'approved' ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : ''}
                                                    ${status === 'processing' ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : ''}
                                                `}
                                            >
                                                <span>→</span>
                                                {statusLabels[status]}
                                            </button>
                                        ))}
                                    </div>
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
                                        {order.profiles?.full_name || order.shipping_address?.full_name || 'Khách vãng lai'}
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
