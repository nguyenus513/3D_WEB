'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navLinks = [
    { name: 'HOME', href: '/', active: true },
    { name: 'SẢN PHẨM', href: '/products' },
    { name: 'CUSTOM', href: '/custom' },
    { name: 'IN 3D', href: '/printing' },
    { name: 'LIÊN HỆ', href: '/about' },
];

export function NavLusion() {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const cartCount = 2; // Mock cart count - will be from state later

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            {/* Fixed Header */}
            <header className="fixed top-0 left-0 right-0 z-[100] p-4 md:p-6">
                <div className="flex items-center gap-3">
                    {/* Logo Icon */}
                    <Link href="/" className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                        <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </Link>

                    {/* Let's Talk Button */}
                    <Link
                        href="/about"
                        className="px-5 py-3 rounded-full bg-[#1D1D1F] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#2D2D2F] transition-colors"
                    >
                        LIÊN HỆ
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3]" />
                    </Link>

                    {/* Cart Icon */}
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

                    {/* Menu Toggle */}
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="px-5 py-3 rounded-full bg-white/10 backdrop-blur-xl text-white text-sm font-medium flex items-center gap-2 hover:bg-white/20 transition-colors border border-white/10"
                    >
                        {isOpen ? 'ĐÓNG' : 'MENU'}
                        <span className="flex flex-col gap-0.5">
                            <span className={`w-1 h-1 rounded-full bg-white transition-all ${isOpen ? 'translate-y-0.5' : ''}`} />
                            <span className={`w-1 h-1 rounded-full bg-white transition-all ${isOpen ? '-translate-y-0.5' : ''}`} />
                        </span>
                    </button>
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
                            <div className="bg-white rounded-3xl p-6 shadow-2xl">
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
                                                className="flex items-center justify-between py-3 px-4 rounded-xl text-[#1D1D1F] font-medium text-lg hover:bg-[#F5F5F7] transition-colors group"
                                            >
                                                {link.name}
                                                {link.active && (
                                                    <span className="w-2 h-2 rounded-full bg-[#1D1D1F]" />
                                                )}
                                            </Link>
                                        </motion.div>
                                    ))}
                                </nav>
                            </div>

                            {/* Account Card */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-white rounded-3xl p-6 shadow-2xl"
                            >
                                <h3 className="text-[#1D1D1F] font-semibold text-lg mb-4 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-full bg-[#F5F5F7] flex items-center justify-center">
                                        <svg className="w-4 h-4 text-[#1D1D1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </span>
                                    Tài Khoản
                                </h3>

                                {/* Quick Links */}
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <Link
                                        href="/cart"
                                        onClick={() => setIsOpen(false)}
                                        className="flex items-center gap-2 p-3 bg-[#F5F5F7] rounded-xl hover:bg-[#E8E8ED] transition-colors"
                                    >
                                        <svg className="w-4 h-4 text-[#1D1D1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                        </svg>
                                        <span className="text-[#1D1D1F] text-sm font-medium">Giỏ hàng</span>
                                        {cartCount > 0 && (
                                            <span className="ml-auto text-xs bg-[#0071E3] text-white px-2 py-0.5 rounded-full">
                                                {cartCount}
                                            </span>
                                        )}
                                    </Link>
                                    <Link
                                        href="/faq"
                                        onClick={() => setIsOpen(false)}
                                        className="flex items-center gap-2 p-3 bg-[#F5F5F7] rounded-xl hover:bg-[#E8E8ED] transition-colors"
                                    >
                                        <svg className="w-4 h-4 text-[#1D1D1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-[#1D1D1F] text-sm font-medium">FAQ</span>
                                    </Link>
                                </div>

                                {/* Auth Buttons */}
                                <div className="flex gap-2">
                                    <Link
                                        href="/login"
                                        onClick={() => setIsOpen(false)}
                                        className="flex-1 py-2.5 text-center text-[#0071E3] font-medium text-sm border border-[#0071E3] rounded-full hover:bg-[#0071E3] hover:text-white transition-colors"
                                    >
                                        Đăng nhập
                                    </Link>
                                    <Link
                                        href="/register"
                                        onClick={() => setIsOpen(false)}
                                        className="flex-1 py-2.5 text-center text-white font-medium text-sm bg-[#0071E3] rounded-full hover:bg-[#0077ED] transition-colors"
                                    >
                                        Đăng ký
                                    </Link>
                                </div>
                            </motion.div>

                            {/* Order Now Button */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <Link
                                    href="/custom"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center justify-between bg-[#0071E3] rounded-full px-6 py-4 hover:bg-[#0077ED] transition-colors group"
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

