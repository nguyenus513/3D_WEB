'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAdminPath } from '@/hooks/useAdminPath';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { Menu, Search, Bell, CheckCircle, Pencil, ShoppingBag, Upload, Check } from 'lucide-react';

const typeLabels: Record<string, string> = {
    ready_made: 'Sản phẩm',
    custom: 'Custom',
    printing: 'In 3D',
};

/** Get notification icon and color based on type */
function getNotificationStyle(notification: Notification) {
    switch (notification.type) {
        case 'design_approved':
            return {
                icon: <CheckCircle size={16} className="text-emerald-400" strokeWidth={1.5} />,
                bg: 'bg-emerald-500/20',
            };
        case 'design_rejected':
            return {
                icon: <Pencil size={16} className="text-amber-400" strokeWidth={1.5} />,
                bg: 'bg-amber-500/20',
            };
        case 'design_uploaded':
            return {
                icon: <Upload size={16} className="text-cyan-400" strokeWidth={1.5} />,
                bg: 'bg-cyan-500/20',
            };
        default:
            return {
                icon: <ShoppingBag size={16} className="text-blue-400" strokeWidth={1.5} />,
                bg: 'bg-blue-500/20',
            };
    }
}

export function AdminHeader({ onMenuClick }: { onMenuClick?: () => void }) {
    const { adminRoot } = useAdminPath();
    const [showNotifications, setShowNotifications] = useState(false);

    const {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        latestNotification,
        clearLatest,
    } = useNotifications({
        endpoint: '/api/admin/notifications',
        refreshInterval: 15000,
    });

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

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.is_read) {
            await markAsRead(notification.id);
        }
        setShowNotifications(false);
    };

    const getNotificationLink = (notification: Notification): string => {
        if (notification.ref_id && notification.ref_type === 'order') {
            return `${adminRoot}/orders/${notification.ref_id}`;
        }
        return `${adminRoot}/orders`;
    };

    return (
        // Matching Miniver theme #1D1D1F
        <header className="sticky top-0 z-40 bg-[#1D1D1F] border-b border-white/5">
            <div className="flex items-center justify-between h-16 px-4 lg:px-6">
                {/* Mobile menu button */}
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 rounded-xl hover:bg-white/5 transition-colors mr-2"
                >
                    <Menu size={24} className="text-white" strokeWidth={1.5} />
                </button>

                {/* Search */}
                <div className="flex-1 max-w-md">
                    <div className="relative">
                        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" strokeWidth={1.5} />
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
                            <Bell size={20} className="text-white/70" strokeWidth={1.5} />
                            {/* Badge */}
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center px-1">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Dropdown */}
                        {showNotifications && (
                            <div className="absolute right-0 mt-2 w-96 bg-[#1D1D1F] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[100]">
                                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                    <h3 className="text-white font-semibold">Thông báo</h3>
                                    <div className="flex items-center gap-2">
                                        {unreadCount > 0 && (
                                            <>
                                                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                                                    {unreadCount} mới
                                                </span>
                                                <button
                                                    onClick={markAllAsRead}
                                                    className="text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
                                                >
                                                    <Check size={12} /> Đọc hết
                                                </button>
                                            </>
                                        )}
                                    </div>
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
                                        notifications.map((n) => {
                                            const style = getNotificationStyle(n);
                                            return (
                                                <Link
                                                    key={n.id}
                                                    href={getNotificationLink(n)}
                                                    onClick={() => handleNotificationClick(n)}
                                                    className={`block p-4 border-b border-white/5 hover:bg-white/5 transition-colors ${!n.is_read ? 'bg-white/[0.02]' : ''
                                                        }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        {/* Unread indicator */}
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            {!n.is_read && (
                                                                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                                            )}
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${style.bg}`}>
                                                                {style.icon}
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm ${!n.is_read ? 'text-white font-medium' : 'text-white/60'}`}>
                                                                {n.title}
                                                            </p>
                                                            {n.message && (
                                                                <p className="text-white/40 text-xs mt-0.5 truncate">
                                                                    {n.message}
                                                                </p>
                                                            )}
                                                            <p className="text-white/30 text-xs mt-1">
                                                                {formatTime(n.created_at)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </Link>
                                            );
                                        })
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

            {/* Realtime Toast */}
            {latestNotification && (
                <div className="fixed top-20 right-6 z-[200] animate-in slide-in-from-right duration-300">
                    <div className="bg-[#2a2a2c] border border-white/10 rounded-xl shadow-2xl p-4 max-w-sm flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getNotificationStyle(latestNotification).bg}`}>
                            {getNotificationStyle(latestNotification).icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium">{latestNotification.title}</p>
                            {latestNotification.message && (
                                <p className="text-white/40 text-xs mt-0.5 truncate">{latestNotification.message}</p>
                            )}
                        </div>
                        <button
                            onClick={clearLatest}
                            className="text-white/30 hover:text-white/60 flex-shrink-0"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
}
