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
                    <Link href="/" className="w-12 h-12 rounded-full bg-white flex items-center justify-center" data-cursor>
                        <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </Link>

                    {/* Let's Talk Button */}
                    <Link
                        href="/about"
                        className="px-5 py-3 rounded-full bg-[#1D1D1F] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#2D2D2F] transition-colors"
                        data-cursor
                    >
                        LIÊN HỆ
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3]" />
                    </Link>

                    {/* Menu Toggle */}
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="px-5 py-3 rounded-full bg-white/10 backdrop-blur-xl text-white text-sm font-medium flex items-center gap-2 hover:bg-white/20 transition-colors border border-white/10"
                        data-cursor
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
                                                data-cursor
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

                            {/* Newsletter Card */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-white rounded-3xl p-6 shadow-2xl"
                            >
                                <h3 className="text-[#1D1D1F] font-semibold text-xl mb-4">
                                    Đăng ký nhận tin
                                </h3>
                                <form className="flex items-center gap-2 bg-[#F5F5F7] rounded-full p-1">
                                    <input
                                        type="email"
                                        placeholder="Email của bạn"
                                        className="flex-1 bg-transparent px-4 py-2 text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none"
                                    />
                                    <button
                                        type="submit"
                                        className="w-10 h-10 rounded-full bg-[#1D1D1F] text-white flex items-center justify-center hover:bg-[#0071E3] transition-colors"
                                        data-cursor
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                    </button>
                                </form>
                            </motion.div>

                            {/* External Link Card (like LABS) */}
                            <motion.a
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                href="https://github.com/Minwsun/3D_WEB"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between bg-[#1D1D1F] rounded-full px-6 py-4 hover:bg-[#2D2D2F] transition-colors group"
                                data-cursor
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.11.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                                        </svg>
                                    </div>
                                    <span className="text-white font-medium">GITHUB</span>
                                </div>
                                <svg className="w-5 h-5 text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
                                </svg>
                            </motion.a>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
