'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/lib/store/cart';
import { useSession } from 'next-auth/react';
import { useNotifications, Notification } from '@/hooks/useNotifications';

const navLinks = [
    {
        name: 'HOME',
        href: '/',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        )
    },
    {
        name: 'SẢN PHẨM',
        href: '/products',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        )
    },
    {
        name: 'CUSTOM',
        href: '/custom',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
        )
    },
    {
        name: 'IN 3D',
        href: '/printing',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
        )
    },
];

/** Get icon for notification type */
function getNotifIcon(type: string) {
    switch (type) {
        case 'design_uploaded': return '🎨';
        case 'design_approved': return '✅';
        case 'design_rejected': return '❌';
        case 'order_status': return '📦';
        case 'payment': return '💰';
        default: return '🔔';
    }
}

export function NavLusion() {
    const [isOpen, setIsOpen] = useState(false);
    const [showNotif, setShowNotif] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const { items } = useCart();
    const cartCount = items.length;
    const { data: session, status } = useSession();
    const isLoggedIn = status === 'authenticated' && session?.user;
    const pathname = usePathname();
    const notifRef = useRef<HTMLDivElement>(null);

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
        enabled: !!isLoggedIn,
    });

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setShowNotif(false);
            }
        };
        if (showNotif) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showNotif]);

    const handleNotifClick = async (n: Notification) => {
        if (!n.is_read) await markAsRead(n.id);
        setShowNotif(false);
    };

    const getNotifLink = (n: Notification): string => {
        if (n.ref_id && n.ref_type === 'order') return `/account/orders/${n.ref_id}`;
        if (n.ref_id && n.ref_type === 'design_version') return `/account/orders/${n.ref_id}/demo`;
        return '/account';
    };

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            {/* Fixed Header */}
            <header className="fixed top-0 left-0 right-0 z-[100] p-4 md:p-6">
                <div className="flex items-center justify-between">
                    {/* Left side - Logo + Menu */}
                    <div className="flex items-center gap-3">
                        {/* Logo Icon */}
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Link href="/" className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                                <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                </svg>
                            </Link>
                        </motion.div>

                        {/* Menu Toggle */}
                        <motion.button
                            onClick={() => setIsOpen(!isOpen)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="h-12 px-5 rounded-full bg-white/10 backdrop-blur-xl text-white text-sm font-medium flex items-center gap-2 hover:bg-white/20 transition-colors border border-white/10"
                        >
                            {isOpen ? 'ĐÓNG' : 'MENU'}
                            <span className="flex flex-col gap-0.5">
                                <span className={`w-1 h-1 rounded-full bg-white transition-all ${isOpen ? 'translate-y-0.5' : ''}`} />
                                <span className={`w-1 h-1 rounded-full bg-white transition-all ${isOpen ? '-translate-y-0.5' : ''}`} />
                            </span>
                        </motion.button>
                    </div>

                    {/* Right side - Notifications + Cart + User Avatar/Auth */}
                    <div className="flex items-center gap-3">
                        {/* Notification Bell — logged in only */}
                        {isLoggedIn && (
                            <div className="relative" ref={notifRef}>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setShowNotif(!showNotif)}
                                    className="relative w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10"
                                    aria-label="Thông báo"
                                >
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </motion.button>

                                {/* Notification Dropdown */}
                                <AnimatePresence>
                                    {showNotif && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                            className="absolute right-0 top-14 w-80 max-h-96 overflow-y-auto bg-[#1D1D1F]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-[200]"
                                        >
                                            <div className="flex items-center justify-between p-4 border-b border-white/10">
                                                <h3 className="text-white text-sm font-semibold">Thông báo</h3>
                                                {unreadCount > 0 && (
                                                    <button
                                                        onClick={() => markAllAsRead()}
                                                        className="text-[#0071E3] text-xs hover:underline"
                                                    >
                                                        Đánh dấu đã đọc
                                                    </button>
                                                )}
                                            </div>
                                            <div className="divide-y divide-white/5">
                                                {notifLoading ? (
                                                    <div className="p-6 text-center text-white/40 text-sm">Đang tải...</div>
                                                ) : notifications.length === 0 ? (
                                                    <div className="p-6 text-center text-white/40 text-sm">Chưa có thông báo</div>
                                                ) : (
                                                    notifications.slice(0, 10).map(n => (
                                                        <Link
                                                            key={n.id}
                                                            href={getNotifLink(n)}
                                                            onClick={() => handleNotifClick(n)}
                                                            className={`flex items-start gap-3 p-3 hover:bg-white/5 transition-colors ${!n.is_read ? 'bg-white/[0.03]' : ''
                                                                }`}
                                                        >
                                                            <span className="text-lg mt-0.5">{getNotifIcon(n.type)}</span>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-sm ${!n.is_read ? 'text-white font-medium' : 'text-white/70'}`}>
                                                                    {n.title}
                                                                </p>
                                                                {n.message && (
                                                                    <p className="text-xs text-white/40 mt-0.5 truncate">{n.message}</p>
                                                                )}
                                                                <p className="text-[10px] text-white/30 mt-1">
                                                                    {new Date(n.created_at).toLocaleDateString('vi-VN', {
                                                                        day: '2-digit', month: '2-digit',
                                                                        hour: '2-digit', minute: '2-digit',
                                                                    })}
                                                                </p>
                                                            </div>
                                                            {!n.is_read && (
                                                                <span className="w-2 h-2 rounded-full bg-[#0071E3] mt-2 flex-shrink-0" />
                                                            )}
                                                        </Link>
                                                    ))
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* Cart Icon */}
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Link
                                href="/cart"
                                className="relative w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10"
                            >
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                                {cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#0071E3] text-white text-xs flex items-center justify-center font-medium">
                                        {cartCount}
                                    </span>
                                )}
                            </Link>
                        </motion.div>

                        {/* User Avatar or Auth Buttons */}
                        {isLoggedIn ? (
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                <Link
                                    href="/account"
                                    className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center text-white font-bold text-sm hover:bg-white/20 transition-all border border-white/10"
                                    title={session.user?.name || 'Tài khoản'}
                                >
                                    {session.user?.name?.charAt(0).toUpperCase() || 'U'}
                                </Link>
                            </motion.div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                    <Link
                                        href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}
                                        className="h-12 px-5 rounded-full bg-white/10 backdrop-blur-xl text-white text-sm font-medium flex items-center hover:bg-white/20 transition-colors border border-white/10"
                                    >
                                        Đăng nhập
                                    </Link>
                                </motion.div>
                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                    <Link
                                        href={`/register?callbackUrl=${encodeURIComponent(pathname)}`}
                                        className="h-12 px-5 rounded-full bg-white/10 backdrop-blur-xl text-white text-sm font-medium flex items-center hover:bg-white/20 transition-colors border border-white/10"
                                    >
                                        Đăng ký
                                    </Link>
                                </motion.div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop - Darker & Faster */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Menu Panel - Spring Physics */}
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.98 }}
                            transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 25,
                                mass: 1
                            }}
                            className="fixed top-24 left-4 md:left-6 z-[95] w-[calc(100%-2rem)] md:w-[360px] space-y-4 origin-top"
                        >
                            {/* Navigation Card */}
                            <div className="bg-[#1D1D1F]/90 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl border border-white/10 overflow-hidden">
                                <nav className="space-y-1">
                                    {navLinks.map((link) => {
                                        // Calculate active state dynamically
                                        const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));

                                        return (
                                            <Link
                                                key={link.name}
                                                href={link.href}
                                                onClick={() => setIsOpen(false)}
                                                className={`flex items-center gap-4 py-3 px-4 rounded-xl text-white font-medium text-lg hover:bg-white/10 transition-colors group relative ${isActive ? 'bg-white/5' : ''}`}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border ${isActive ? 'bg-white/20 text-white border-white/20' : 'bg-white/5 text-white/70 group-hover:text-white group-hover:bg-white/20 border-white/5'}`}>
                                                    {link.icon}
                                                </div>
                                                <div className="flex-1 flex items-center justify-between">
                                                    {link.name}
                                                    {/* Active Indicator Dot */}
                                                    {isActive && (
                                                        <motion.span
                                                            layoutId="nav-dot"
                                                            className="w-2 h-2 rounded-full bg-[#0071E3] shadow-[0_0_8px_#0071E3]"
                                                        />
                                                    )}
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </nav>
                            </div>

                            {/* Order Now Button - Instant appearance */}
                            <Link
                                href="/custom"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center justify-between bg-[#0071E3] text-white rounded-full px-6 py-4 hover:bg-[#0077ED] transition-all group shadow-[0_8px_20px_-5px_rgba(0,113,227,0.4)]"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                        </svg>
                                    </div>
                                    <span className="font-bold tracking-wide">ĐẶT HÀNG NGAY</span>
                                </div>
                                <svg className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </Link>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Realtime Notification Toast */}
            <AnimatePresence>
                {isLoggedIn && latestNotification && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-20 right-4 md:right-6 z-[150] max-w-xs"
                    >
                        <div
                            className="bg-[#1D1D1F]/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-3 shadow-2xl cursor-pointer flex items-start gap-2"
                            onClick={() => clearLatest()}
                        >
                            <span className="text-lg flex-shrink-0 mt-0.5">{getNotifIcon(latestNotification.type)}</span>
                            <div className="min-w-0">
                                <p className="text-white text-xs font-medium">{latestNotification.title}</p>
                                {latestNotification.message && (
                                    <p className="text-white/40 text-[10px] mt-0.5 truncate">{latestNotification.message}</p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
