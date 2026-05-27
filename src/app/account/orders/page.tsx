'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { Box, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatOrderDate } from '@/lib/utils/orderStatus';

interface OrderItem {
    id: string;
    item_code: string;
    full_code: string;
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    production_status: string;
    item_type: string;
    product_id?: string | null;
    print_tech?: string;
    color?: string;
    material?: string;
}

interface CartOrder {
    id: string;
    order_code: string;
    created_at: string;
    total_amount: number;
    status: string;
    payment_status?: string;
    order_type?: string;
    thumbnail?: string | null;
    summary?: string;
    items?: OrderItem[];
    notes?: string;
}


const tabs = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Chờ thanh toán' },
    { key: 'processing', label: 'Đang xử lý' },
    { key: 'completed', label: 'Hoàn thành' },
];

const statusColors: Record<string, string> = {
    pending: 'bg-white/10 text-white/70',
    confirmed: 'bg-white/10 text-white',
    processing: 'bg-white/10 text-white',
    designing: 'bg-white/10 text-white',
    review: 'bg-white/10 text-white',
    revising: 'bg-white/10 text-white',
    approved: 'bg-white/10 text-white',
    producing: 'bg-white/10 text-white',
    printing: 'bg-white/10 text-white',
    shipping: 'bg-white/10 text-white',
    delivered: 'bg-white/15 text-white',
    cancelled: 'bg-white/5 text-white/50',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ thanh toán',
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

export default function AccountOrdersPage() {
    const { data: session, status } = useSession();
    const [orders, setOrders] = useState<CartOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [showAllOrders, setShowAllOrders] = useState(false);

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.email) {
            fetchOrders();
        } else if (status === 'unauthenticated') {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, session]);

    useEffect(() => {
        setShowAllOrders(false);
    }, [activeTab]);

    const fetchOrders = async () => {
        if (!session?.user?.email) return;

        try {
            const res = await fetch('/api/orders/my-orders');
            if (res.ok) {
                const response = await res.json();
                const ordersData = Array.isArray(response.data) ? response.data : [];
                setOrders(ordersData);
            } else {
                console.error('Failed to fetch orders:', res.statusText);
            }
        } catch (e) {
            console.error('Failed to fetch orders', e);
        }
        setLoading(false);
    };

    const filteredOrders = (activeTab === 'all'
        ? orders
        : activeTab === 'processing'
            ? orders.filter(o => ['confirmed', 'processing', 'designing', 'review', 'revising', 'approved', 'producing', 'printing', 'shipping'].includes(o.status))
            : activeTab === 'completed'
                ? orders.filter(o => o.status === 'delivered')
                : orders.filter(o => o.status === activeTab)
    ).slice().sort((a, b) => {
        const bTime = new Date(b.created_at || 0).getTime() || 0;
        const aTime = new Date(a.created_at || 0).getTime() || 0;
        return bTime - aTime;
    });
    const visibleOrders = showAllOrders ? filteredOrders : filteredOrders.slice(0, 5);
    const hiddenOrderCount = Math.max(filteredOrders.length - visibleOrders.length, 0);

    const renderOrderThumb = (order: CartOrder) => {
        if (order.order_type === 'printing' || order.order_type === 'print_3d') {
            return <span className="text-sm font-semibold tracking-widest text-[var(--text-secondary)]">3D</span>;
        }
        if (order.thumbnail) {
            return <img src={order.thumbnail} alt={order.summary || order.order_code} className="h-full w-full object-cover" />;
        }
        return <Box size={24} className="text-[var(--text-tertiary)]" strokeWidth={1.5} />;
    };

    if (status === 'loading' || loading) {
        return (
            <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[var(--text-secondary)]">Đang tải đơn hàng...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">Đơn hàng của tôi</h1>
                    <p className="text-[var(--text-secondary)] mt-1">
                        {orders.length} đơn hàng
                    </p>
                </div>
                <button onClick={fetchOrders} className="px-4 py-2 bg-[var(--material-glass)] backdrop-blur-xl border border-[var(--border-color)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    Làm mới
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === tab.key
                            ? 'bg-[var(--text-primary)] text-[var(--bg-void)]'
                            : 'bg-[var(--material-glass)] backdrop-blur-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Orders list */}
            <div className="space-y-4">
                {visibleOrders.map((order, index) => (
                    <motion.div
                        key={order.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-[var(--material-glass)] backdrop-blur-xl rounded-2xl border border-[var(--border-color)] overflow-hidden"
                    >
                        {/* Order header */}
                        <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <span className="text-[var(--text-primary)] font-semibold font-mono">
                                    {order.order_code}
                                </span>
                                <span className="text-[var(--text-secondary)] text-sm">
                                    {formatOrderDate(order.created_at)} • {order.summary || order.items?.[0]?.name || 'Sản phẩm'} • {order.items?.length || 1} sản phẩm
                                </span>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                                {statusLabels[order.status] || order.status}
                            </span>
                        </div>

                        {/* Order items - ALWAYS render regardless of count */}
                        <div className="p-5">
                            <div className="space-y-3">
                                {/* EmptyState when no items */}
                                {(!order.items || order.items.length === 0) && (
                                    <div className="text-center py-4 text-[var(--text-tertiary)]">
                                        <Box size={32} className="mx-auto mb-2 opacity-50 text-[var(--text-tertiary)]" strokeWidth={1.5} />
                                        <p className="text-sm">Đơn hàng đang xử lý</p>
                                    </div>
                                )}

                                {/* Render ALL items (slice removed for showing at least first 3) */}
                                {order.items && order.items.slice(0, 3).map((item, i) => (
                                    <div key={item.full_code || i} className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-[var(--material-glass)] flex items-center justify-center overflow-hidden">
                                            {i === 0 ? renderOrderThumb(order) : <Box size={24} className="text-[var(--text-tertiary)]" strokeWidth={1.5} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[var(--text-primary)] truncate">{item.name}</p>
                                            <p className="text-[var(--text-secondary)] text-sm">x{item.quantity}</p>
                                        </div>
                                        <p className="text-[var(--text-primary)] font-medium">{Number(item.total_price).toLocaleString('vi-VN')} VND</p>
                                    </div>
                                ))}

                                {/* Show +N more if more than 3 items */}
                                {order.items && order.items.length > 3 && (
                                    <p className="text-[var(--text-secondary)] text-sm">+{order.items.length - 3} sản phẩm khác</p>
                                )}
                            </div>
                        </div>

                        {/* Order footer */}
                        <div className="px-5 py-4 bg-[var(--material-glass)] flex items-center justify-between">
                            <div>
                                <span className="text-[var(--text-secondary)] text-sm">Tổng cộng: </span>
                                <span className="text-[var(--text-primary)] font-semibold">{Number(order.total_amount).toLocaleString('vi-VN')} VND</span>
                            </div>
                            <Link
                                href={`/account/orders/${order.id}`}
                                className="px-4 py-2 rounded-xl bg-[var(--material-glass)] text-[var(--text-primary)] text-sm hover:bg-[var(--material-glass)]"
                            >
                                Xem chi tiết
                            </Link>
                        </div>
                    </motion.div>
                ))}

                {filteredOrders.length > 5 && (
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={() => setShowAllOrders(prev => !prev)}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[var(--material-glass)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm font-medium hover:bg-white/10 transition-colors"
                        >
                            {showAllOrders ? (
                                <>
                                    Thu gọn
                                    <ChevronUp size={16} strokeWidth={1.75} />
                                </>
                            ) : (
                                <>
                                    Xem thêm {hiddenOrderCount} đơn
                                    <ChevronDown size={16} strokeWidth={1.75} />
                                </>
                            )}
                        </button>
                    </div>
                )}

                {filteredOrders.length === 0 && (
                    <div className="text-center py-12 bg-[var(--material-glass)] backdrop-blur-xl rounded-2xl border border-[var(--border-color)]">
                        <p className="text-[var(--text-secondary)]">Không có đơn hàng nào</p>
                        <Link href="/products" className="inline-block mt-4 px-6 py-2 bg-[var(--text-primary)] text-[var(--bg-void)] rounded-xl font-medium">
                            Mua sắm ngay
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
