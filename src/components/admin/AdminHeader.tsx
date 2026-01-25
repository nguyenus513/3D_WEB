'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAdminPath } from '@/hooks/useAdminPath';
import { getSupabase } from '@/lib/supabase/client';

interface Notification {
    id: string;
    order_code: string;
    order_type: string;
    status: string;
    total: number;
    created_at: string;
}

const typeLabels: Record<string, string> = {
    ready_made: 'Sản phẩm',
    custom: 'Custom',
    printing: 'In 3D',
};

export function AdminHeader({ onMenuClick }: { onMenuClick?: () => void }) {
    const { adminRoot } = useAdminPath();
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch on mount
        fetchNotifications();
        // Refresh every 1 second
        const interval = setInterval(fetchNotifications, 1000);
        return () => clearInterval(interval);
    }, []);

    // Also fetch when dropdown opens
    useEffect(() => {
        if (showNotifications) {
            fetchNotifications();
        }
    }, [showNotifications]);

    const fetchNotifications = async () => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('orders')
            .select('id, order_code, order_type, status, total, created_at')
            .in('status', ['pending', 'paid'])
            .order('created_at', { ascending: false })
            .limit(10);

        if (!error && data) {
            setNotifications(data);
        }
        setLoading(false);
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} giờ trước`;

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} ngày trước`;
    };

    const pendingCount = notifications.filter(n => n.status === 'pending').length;

    return (
        <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/10">
            <div className="flex items-center justify-between h-16 px-4 lg:px-6">
                {/* Mobile menu button */}
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 rounded-xl hover:bg-white/5 transition-colors mr-2"
                >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>

                {/* Search */}
                <div className="flex-1 max-w-md">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Tìm kiếm..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                        />
                    </div>
                </div>

                {/* Right section */}
                <div className="flex items-center gap-3">
                    {/* Notifications */}
                    <div className="relative">
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="relative p-2.5 rounded-xl hover:bg-white/5 transition-colors"
                        >
                            <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {/* Badge - only show if there are pending orders */}
                            {pendingCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center px-1">
                                    {pendingCount > 9 ? '9+' : pendingCount}
                                </span>
                            )}
                        </button>

                        {/* Dropdown */}
                        {showNotifications && (
                            <div className="absolute right-0 mt-2 w-96 bg-[#1D1D1F] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[100]">
                                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                    <h3 className="text-white font-semibold">Thông báo</h3>
                                    {pendingCount > 0 && (
                                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                                            {pendingCount} chờ thanh toán
                                        </span>
                                    )}
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {loading ? (
                                        <div className="p-8 text-center">
                                            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
                                        </div>
                                    ) : notifications.length === 0 ? (
                                        <div className="p-8 text-center text-white/50">
                                            Không có thông báo mới
                                        </div>
                                    ) : (
                                        notifications.map((n) => (
                                            <Link
                                                key={n.id}
                                                href={`${adminRoot}/orders/${n.id}`}
                                                onClick={() => setShowNotifications(false)}
                                                className="block p-4 border-b border-white/5 hover:bg-white/5 transition-colors"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${n.status === 'pending' ? 'bg-yellow-500/20' : 'bg-blue-500/20'
                                                        }`}>
                                                        <svg className={`w-4 h-4 ${n.status === 'pending' ? 'text-yellow-400' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                                        </svg>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-white text-sm font-medium">{n.order_code}</span>
                                                            <span className={`text-xs px-1.5 py-0.5 rounded ${n.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
                                                                }`}>
                                                                {n.status === 'pending' ? 'Chờ TT' : 'Đã TT'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-white/50 text-xs">{typeLabels[n.order_type] || n.order_type}</span>
                                                            <span className="text-white/30">•</span>
                                                            <span className="text-white/50 text-xs">{Number(n.total).toLocaleString('vi-VN')}đ</span>
                                                        </div>
                                                        <p className="text-white/40 text-xs mt-1">{formatTime(n.created_at)}</p>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))
                                    )}
                                </div>
                                <div className="p-3 border-t border-white/10">
                                    <Link
                                        href={`${adminRoot}/orders`}
                                        onClick={() => setShowNotifications(false)}
                                        className="block text-center text-sm text-white/70 hover:text-white transition-colors"
                                    >
                                        Xem tất cả đơn hàng
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
