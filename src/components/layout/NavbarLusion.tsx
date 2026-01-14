'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Magnetic } from '../ui/Animations';

const navLinks = [
    { name: 'Sản phẩm', href: '/products' },
    { name: 'Custom', href: '/custom' },
    { name: 'In 3D', href: '/printing' },
    { name: 'FAQ', href: '/faq' },
    { name: 'About', href: '/about' },
];

export function NavbarLusion() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            {/* Fixed Header - Lusion Style */}
            <header className="fixed top-0 left-0 right-0 z-[100] pointer-events-none">
                <div className="flex items-center justify-between p-4 md:p-6">
                    {/* Logo - Top Left */}
                    <Magnetic>
                        <Link
                            href="/"
                            className="pointer-events-auto"
                            data-cursor
                            data-cursor-text=""
                        >
                            <motion.div
                                className={`
                  px-4 py-2 rounded-full
                  backdrop-blur-xl
                  transition-all duration-500
                  ${scrolled
                                        ? 'bg-white/10 border border-white/10'
                                        : 'bg-transparent'
                                    }
                `}
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6 }}
                            >
                                <span className="text-lg font-semibold text-white">3D Print</span>
                            </motion.div>
                        </Link>
                    </Magnetic>

                    {/* Right Side - Menu & Contact */}
                    <div className="flex items-center gap-3 pointer-events-auto">
                        {/* Cart */}
                        <Magnetic>
                            <Link
                                href="/cart"
                                className={`
                  w-12 h-12 rounded-full flex items-center justify-center
                  backdrop-blur-xl transition-all duration-500
                  ${scrolled
                                        ? 'bg-white/10 border border-white/10'
                                        : 'bg-white/5'
                                    }
                  hover:bg-white/20
                `}
                                data-cursor
                                data-cursor-text="Cart"
                            >
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                            </Link>
                        </Magnetic>

                        {/* Contact Button */}
                        <Magnetic>
                            <Link
                                href="/about"
                                className={`
                  px-5 py-3 rounded-full text-sm font-medium
                  backdrop-blur-xl transition-all duration-500
                  bg-white text-black
                  hover:scale-105
                `}
                                data-cursor
                                data-cursor-text=""
                            >
                                Liên hệ
                            </Link>
                        </Magnetic>

                        {/* Menu Button */}
                        <Magnetic>
                            <button
                                onClick={() => setIsMenuOpen(true)}
                                className={`
                  px-5 py-3 rounded-full text-sm font-medium
                  backdrop-blur-xl transition-all duration-500
                  ${scrolled
                                        ? 'bg-white/10 border border-white/10'
                                        : 'bg-white/5'
                                    }
                  text-white hover:bg-white/20
                `}
                                data-cursor
                                data-cursor-text=""
                            >
                                Menu
                            </button>
                        </Magnetic>
                    </div>
                </div>
            </header>

            {/* Full Screen Menu Overlay */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="fixed inset-0 z-[200] bg-black"
                    >
                        {/* Close Button */}
                        <button
                            onClick={() => setIsMenuOpen(false)}
                            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                            data-cursor
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Menu Content */}
                        <div className="h-full flex flex-col items-center justify-center">
                            <nav className="space-y-4">
                                {navLinks.map((link, index) => (
                                    <motion.div
                                        key={link.name}
                                        initial={{ opacity: 0, y: 40 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -40 }}
                                        transition={{ delay: index * 0.1, duration: 0.5 }}
                                    >
                                        <Link
                                            href={link.href}
                                            onClick={() => setIsMenuOpen(false)}
                                            className="block text-5xl md:text-7xl font-semibold text-white hover:text-[#0071E3] transition-colors"
                                            data-cursor
                                            data-cursor-text="View"
                                        >
                                            {link.name}
                                        </Link>
                                    </motion.div>
                                ))}
                            </nav>

                            {/* Footer in menu */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="absolute bottom-8 left-0 right-0 px-8"
                            >
                                <div className="flex justify-between items-center text-sm text-white/50">
                                    <span>© 2026 3D Print</span>
                                    <div className="flex gap-6">
                                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                                        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
