'use client';

import Image from 'next/image';
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
    const [currentPath, setCurrentPath] = useState(pathname);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const pathWithQuery = `${pathname}${window.location.search}`;
        setCurrentPath(pathWithQuery);
        if (!pathname.startsWith('/login') && !pathname.startsWith('/register')) {
            sessionStorage.setItem('miniver.returnTo', pathWithQuery);
        }
    }, [pathname]);


    return (
        <>
            {/* Fixed Header */}
            <header className="fixed top-0 left-0 right-0 z-[100] p-4 md:p-6">
                <div className="flex items-center justify-between">
                    {/* Left side - Logo + Menu */}
                    <div className="flex items-center gap-3">
                        {/* Logo Icon */}
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Link href="/" className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden">
                                <Image src="/brand/miniver-icon-round.png" alt="Miniver" width={40} height={40} priority className="h-10 w-10 object-contain" />
                            </Link>
                        </motion.div>

                        {/* Menu Toggle */}
                        <motion.button
                            onClick={() => setIsOpen(!isOpen)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="h-12 px-5 rounded-full bg-[var(--material-glass)] backdrop-blur-xl text-[var(--text-primary)] text-sm font-medium flex items-center gap-2 hover:bg-[var(--material-glass)] transition-colors border border-[var(--border-color)]"
                        >
                            {isOpen ? 'ĐÓNG' : 'MENU'}
                            <span className="flex flex-col gap-0.5">
                                <span className={`w-1 h-1 rounded-full bg-[var(--text-primary)] transition-all ${isOpen ? 'translate-y-0.5' : ''}`} />
                                <span className={`w-1 h-1 rounded-full bg-[var(--text-primary)] transition-all ${isOpen ? '-translate-y-0.5' : ''}`} />
                            </span>
                        </motion.button>
                    </div>

                    {/* Right side - Cart + User Avatar/Auth */}
                    <div className="flex items-center gap-3">
                        {/* Cart Icon */}
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Link
                                href="/cart"
                                className="relative w-12 h-12 rounded-full bg-[var(--material-glass)] backdrop-blur-xl flex items-center justify-center hover:bg-[var(--material-glass)] transition-colors border border-[var(--border-color)]"
                            >
                                <svg className="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                                {cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--color-accent)] text-[var(--text-primary)] text-xs flex items-center justify-center font-medium">
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
                                    className="w-12 h-12 rounded-full bg-[var(--material-glass)] backdrop-blur-xl flex items-center justify-center text-[var(--text-primary)] font-bold text-sm hover:bg-[var(--material-glass)] transition-all border border-[var(--border-color)]"
                                    title={session.user?.name || 'Tài khoản'}
                                >
                                    {session.user?.name?.charAt(0).toUpperCase() || 'U'}
                                </Link>
                            </motion.div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                    <Link
                                        href={`/login?callbackUrl=${encodeURIComponent(currentPath)}`}
                                        className="h-12 px-5 rounded-full bg-[var(--material-glass)] backdrop-blur-xl text-[var(--text-primary)] text-sm font-medium flex items-center hover:bg-[var(--material-glass)] transition-colors border border-[var(--border-color)]"
                                    >
                                        Đăng nhập
                                    </Link>
                                </motion.div>
                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                    <Link
                                        href={`/register?callbackUrl=${encodeURIComponent(currentPath)}`}
                                        className="h-12 px-5 rounded-full bg-[var(--material-glass)] backdrop-blur-xl text-[var(--text-primary)] text-sm font-medium flex items-center hover:bg-[var(--material-glass)] transition-colors border border-[var(--border-color)]"
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
                            <div className="bg-[var(--material-panel)]/90 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl border border-[var(--border-color)] overflow-hidden">
                                <nav className="space-y-1">
                                    {navLinks.map((link) => {
                                        const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));

                                        return (
                                            <Link
                                                key={link.name}
                                                href={link.href}
                                                onClick={() => setIsOpen(false)}
                                                className={`group relative flex items-center gap-4 rounded-xl px-4 py-3 text-lg font-medium transition-colors active:bg-white/80 ${isActive ? 'bg-white text-black hover:bg-white/90' : 'text-white hover:bg-white/10'}`}
                                            >
                                                <div className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all ${isActive ? 'border-black/20 bg-black text-white' : 'border-white/15 bg-white/10 text-white group-hover:bg-white/15'}`}>
                                                    {link.icon}
                                                </div>
                                                <div className="flex-1 flex items-center justify-between">
                                                    {link.name}
                                                    {isActive && (
                                                        <motion.span
                                                            layoutId="nav-dot"
                                                            className="h-2 w-2 rounded-full bg-black shadow-[0_0_8px_rgba(0,0,0,0.35)]"
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
                                className="group flex items-center justify-between rounded-full bg-white px-6 py-4 text-black shadow-[0_10px_28px_-10px_rgba(255,255,255,0.55)] transition-all hover:bg-white/90 active:bg-white/80"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">
                                        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                        </svg>
                                    </div>
                                    <span className="font-bold tracking-wide">ĐẶT HÀNG NGAY</span>
                                </div>
                                <svg className="h-5 w-5 text-black transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </Link>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

        </>
    );
}
