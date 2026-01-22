'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/lib/store/cart';
import { useSession } from 'next-auth/react';

const navLinks = [
    {
        name: 'HOME',
        href: '/',
        active: true,
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

export function NavLusion() {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const { items } = useCart();
    const cartCount = items.length;
    const { data: session, status } = useSession();
    const isLoggedIn = status === 'authenticated' && session?.user;
    const pathname = usePathname();

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

                    {/* Right side - Cart + User Avatar/Auth */}
                    <div className="flex items-center gap-3">
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
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="fixed inset-0 z-[90]"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Menu Panel */}
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                            className="fixed top-24 left-4 md:left-6 z-[95] w-[calc(100%-2rem)] md:w-[360px] space-y-4"
                        >
                            {/* Navigation Card */}
                            <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20">
                                <nav className="space-y-1">
                                    {navLinks.map((link, index) => (
                                        <motion.div
                                            key={link.name}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                        >
                                            <Link
                                                href={link.href}
                                                onClick={() => setIsOpen(false)}
                                                className="flex items-center gap-4 py-3 px-4 rounded-xl text-white font-medium text-lg hover:bg-white/10 transition-colors group"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 group-hover:text-white group-hover:bg-white/20 transition-all">
                                                    {link.icon}
                                                </div>
                                                <div className="flex-1 flex items-center justify-between">
                                                    {link.name}
                                                    {link.active && (
                                                        <span className="w-2 h-2 rounded-full bg-white" />
                                                    )}
                                                </div>
                                            </Link>
                                        </motion.div>
                                    ))}
                                </nav>
                            </div>

                            {/* Order Now Button */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <Link
                                    href="/custom"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center justify-between bg-white/10 backdrop-blur-xl border border-white/20 rounded-full px-6 py-4 hover:bg-white/20 transition-all group shadow-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                            </svg>
                                        </div>
                                        <span className="text-white font-medium">ĐẶT HÀNG NGAY</span>
                                    </div>
                                    <svg className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </Link>
                            </motion.div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

