'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { ShoppingBag, User, Menu, X, Bell, CheckCircle, Pencil, Upload } from 'lucide-react';
import { useNotifications, Notification } from '@/hooks/useNotifications';

/** Get icon for notification type */
function getNotifIcon(type: string) {
    switch (type) {
        case 'design_approved': return <CheckCircle size={14} className="text-emerald-400" />;
        case 'design_rejected': return <Pencil size={14} className="text-amber-400" />;
        case 'design_uploaded': return <Upload size={14} className="text-cyan-400" />;
        default: return <ShoppingBag size={14} className="text-blue-400" />;
    }
}

const navLinks = [
    { name: 'Sản phẩm', href: '/products' },
    { name: 'Custom', href: '/custom' },
    { name: 'In 3D', href: '/printing' },
    { name: 'FAQ', href: '/faq' },
    { name: 'About', href: '/about' },
];

export function Navbar() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    const { data: session, status } = useSession();

    const isLoggedIn = status === 'authenticated' && !!session?.user;
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

    const {
        notifications,
        unreadCount,
        loading: notifLoading,
        markAsRead,
        markAllAsRead,
        latestNotification,
        clearLatest,
    } = useNotifications({
        endpoint: '/api/notifications',
        refreshInterval: 30000,
    });

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins}p trước`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h trước`;
        return `${Math.floor(diffHours / 24)}d trước`;
    };

    const handleNotifClick = async (n: Notification) => {
        if (!n.is_read) await markAsRead(n.id);
        setShowNotifDropdown(false);
    };

    const getNotifLink = (n: Notification): string => {
        if (n.ref_id && n.ref_type === 'order') return `/account/orders/${n.ref_id}`;
        return '/account/orders';
    };

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 h-12 bg-black/80 backdrop-blur-xl backdrop-saturate-[180%] z-[1000] border-b border-white/[0.08]">
                <div className="max-w-[1200px] mx-auto px-6 h-full flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="text-xl font-semibold text-white hover:text-white/80 transition-colors">
                        3D Print
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className="text-sm text-[#F5F5F7]/80 hover:text-white transition-colors"
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    {/* Right side - Cart & Account */}
                    <div className="flex items-center gap-4">
                        {/* Cart */}
                        <Link href="/cart" className="text-[#F5F5F7]/80 hover:text-white transition-colors">
                            <ShoppingBag size={20} strokeWidth={1.5} />
                        </Link>

                        {/* Notifications bell — logged in only */}
                        {isLoggedIn && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                                    className="relative text-[#F5F5F7]/80 hover:text-white transition-colors"
                                >
                                    <Bell size={20} strokeWidth={1.5} />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </button>

                                {showNotifDropdown && (
                                    <div className="absolute right-0 top-10 w-80 bg-[#1D1D1F] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                                        <div className="p-3 border-b border-white/10 flex items-center justify-between">
                                            <span className="text-white text-sm font-semibold">Thông báo</span>
                                            {unreadCount > 0 && (
                                                <button
                                                    onClick={markAllAsRead}
                                                    className="text-xs text-white/40 hover:text-white/70 transition-colors"
                                                >
                                                    Đọc hết
                                                </button>
                                            )}
                                        </div>
                                        <div className="max-h-64 overflow-y-auto">
                                            {notifLoading ? (
                                                <div className="p-6 text-center">
                                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
                                                </div>
                                            ) : notifications.length === 0 ? (
                                                <div className="p-6 text-center text-white/40 text-sm">Không có thông báo</div>
                                            ) : (
                                                notifications.slice(0, 10).map(n => (
                                                    <Link
                                                        key={n.id}
                                                        href={getNotifLink(n)}
                                                        onClick={() => handleNotifClick(n)}
                                                        className={`block px-3 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors ${!n.is_read ? 'bg-white/[0.02]' : ''
                                                            }`}
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />}
                                                            <div className="flex-shrink-0 mt-0.5">{getNotifIcon(n.type)}</div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-xs ${!n.is_read ? 'text-white font-medium' : 'text-white/50'}`}>
                                                                    {n.title}
                                                                </p>
                                                                {n.message && <p className="text-white/30 text-[10px] mt-0.5 truncate">{n.message}</p>}
                                                                <p className="text-white/20 text-[10px] mt-0.5">{formatTime(n.created_at)}</p>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                ))
                                            )}
                                        </div>
                                        <Link
                                            href="/account/orders"
                                            onClick={() => setShowNotifDropdown(false)}
                                            className="block p-2.5 text-center text-xs text-white/40 hover:text-white/70 border-t border-white/10 transition-colors"
                                        >
                                            Xem tất cả
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Account - Show different UI based on login status */}
                        {status === 'loading' ? (
                            <div className="w-5 h-5 rounded-full bg-white/10 animate-pulse" />
                        ) : isLoggedIn ? (
                            <div className="relative">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="flex items-center gap-2 text-[#F5F5F7]/80 hover:text-white transition-colors"
                                >
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-medium text-white">
                                        {session.user?.name?.[0]?.toUpperCase() || session.user?.email?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                </button>

                                {/* Dropdown menu */}
                                {showUserMenu && (
                                    <div className="absolute right-0 top-10 w-48 bg-[#1D1D1F] rounded-xl border border-white/10 shadow-xl py-2 z-50">
                                        <div className="px-4 py-2 border-b border-white/10">
                                            <p className="text-white text-sm font-medium truncate">{session.user?.name || 'User'}</p>
                                            <p className="text-white/50 text-xs truncate">{session.user?.email}</p>
                                        </div>
                                        <Link
                                            href="/account"
                                            className="block px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            Tài khoản
                                        </Link>
                                        <Link
                                            href="/account/orders"
                                            className="block px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            Đơn hàng
                                        </Link>
                                        {isAdmin && (
                                            <Link
                                                href="/api/admin/launch"
                                                className="block px-4 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-white/5"
                                                onClick={() => setShowUserMenu(false)}
                                            >
                                                🛡️ Admin Panel
                                            </Link>
                                        )}
                                        <button
                                            onClick={() => signOut({ callbackUrl: '/' })}
                                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-white/5"
                                        >
                                            Đăng xuất
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Link href="/login" className="text-[#F5F5F7]/80 hover:text-white transition-colors">
                                <User size={20} strokeWidth={1.5} />
                            </Link>
                        )}

                        {/* Mobile menu button */}
                        <button
                            className="md:hidden text-[#F5F5F7]/80 hover:text-white"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden absolute top-12 left-0 right-0 bg-black/95 backdrop-blur-xl border-b border-white/[0.08]">
                        <div className="px-6 py-4 space-y-4">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className="block text-base text-[#F5F5F7]/80 hover:text-white transition-colors"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {link.name}
                                </Link>
                            ))}
                            {isLoggedIn ? (
                                <>
                                    <Link
                                        href="/account"
                                        className="block text-base text-[#F5F5F7]/80 hover:text-white transition-colors"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        Tài khoản
                                    </Link>
                                    {isAdmin && (
                                        <Link
                                            href="/api/admin/launch"
                                            className="block text-base text-blue-400 hover:text-blue-300 transition-colors"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            🛡️ Admin Panel
                                        </Link>
                                    )}
                                    <button
                                        onClick={() => signOut({ callbackUrl: '/' })}
                                        className="block text-base text-red-400 hover:text-red-300 transition-colors"
                                    >
                                        Đăng xuất
                                    </button>
                                </>
                            ) : (
                                <Link
                                    href="/login"
                                    className="block text-base text-[#F5F5F7]/80 hover:text-white transition-colors"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Đăng nhập
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            {/* Realtime Toast */}
            {isLoggedIn && latestNotification && (
                <div className="fixed top-16 right-4 z-[2000] animate-in slide-in-from-right duration-300">
                    <div className="bg-[#2a2a2c] border border-white/10 rounded-xl shadow-2xl p-3 max-w-xs flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">{getNotifIcon(latestNotification.type)}</div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-medium">{latestNotification.title}</p>
                            {latestNotification.message && (
                                <p className="text-white/40 text-[10px] mt-0.5 truncate">{latestNotification.message}</p>
                            )}
                        </div>
                        <button onClick={clearLatest} className="text-white/30 hover:text-white/60 text-xs flex-shrink-0">✕</button>
                    </div>
                </div>
            )}
        </>
    );
}
