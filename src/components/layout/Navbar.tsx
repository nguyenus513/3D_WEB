'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';

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
    const { data: session, status } = useSession();

    const isLoggedIn = status === 'authenticated' && !!session?.user;
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

    return (
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
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                    </Link>

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
                                    {/* Admin link removed - auto redirect after login */}
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
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </Link>
                    )}

                    {/* Mobile menu button */}
                    <button
                        className="md:hidden text-[#F5F5F7]/80 hover:text-white"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isMobileMenuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
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
                                {/* Admin link removed from mobile - auto redirect after login */}
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
    );
}
