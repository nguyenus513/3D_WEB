'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { ShoppingBag, User, Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

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
    const pathname = usePathname();
    const [currentPath, setCurrentPath] = useState(pathname);

    useEffect(() => {
        const pathWithQuery = `${pathname}${window.location.search}`;
        setCurrentPath(pathWithQuery);
        if (!pathname.startsWith('/login') && !pathname.startsWith('/register')) {
            sessionStorage.setItem('miniver.returnTo', pathWithQuery);
        }
    }, [pathname]);

    const isLoggedIn = status === 'authenticated' && !!session?.user;
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 h-12 bg-black/80 backdrop-blur-xl backdrop-saturate-[180%] z-[1000] border-b border-[var(--border-color)]">
                <div className="max-w-[1200px] mx-auto px-6 h-full flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center rounded-full bg-white px-3 py-1.5 shadow-sm hover:opacity-90 transition-opacity" aria-label="Miniver home">
                        <Image src="/brand/miniver-logo-full.png" alt="Miniver" width={118} height={34} priority className="h-6 w-auto object-contain" />
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    {/* Right side - Cart & Account */}
                    <div className="flex items-center gap-4">
                        {/* Cart */}
                        <Link href="/cart" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                            <ShoppingBag size={20} strokeWidth={1.5} />
                        </Link>

                        {/* Account - Show different UI based on login status */}
                        {status === 'loading' ? (
                            <div className="w-5 h-5 rounded-full bg-[var(--material-glass)] animate-pulse" />
                        ) : isLoggedIn ? (
                            <div className="relative">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-medium text-[var(--text-primary)]">
                                        {session.user?.name?.[0]?.toUpperCase() || session.user?.email?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                </button>

                                {/* Dropdown menu */}
                                {showUserMenu && (
                                    <div className="absolute right-0 top-10 w-48 bg-[var(--material-panel)] rounded-xl border border-[var(--border-color)] shadow-xl py-2 z-50">
                                        <div className="px-4 py-2 border-b border-[var(--border-color)]">
                                            <p className="text-[var(--text-primary)] text-sm font-medium truncate">{session.user?.name || 'User'}</p>
                                            <p className="text-[var(--text-secondary)] text-xs truncate">{session.user?.email}</p>
                                        </div>
                                        <Link
                                            href="/account"
                                            className="block px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--material-glass)]"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            Tài khoản
                                        </Link>
                                        <Link
                                            href="/account/orders"
                                            className="block px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--material-glass)]"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            Đơn hàng
                                        </Link>
                                        {isAdmin && (
                                            <Link
                                                href="/api/admin/launch"
                                                className="block px-4 py-2 text-sm text-[var(--text-primary)] hover:text-[var(--text-secondary)] hover:bg-[var(--material-glass)]"
                                                onClick={() => setShowUserMenu(false)}
                                            >
                                                Admin Panel
                                            </Link>
                                        )}
                                        <button
                                            onClick={() => signOut({ callbackUrl: '/' })}
                                            className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:text-[var(--text-secondary)] hover:bg-[var(--material-glass)]"
                                        >
                                            Đăng xuất
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Link href={`/login?callbackUrl=${encodeURIComponent(currentPath)}`} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                <User size={20} strokeWidth={1.5} />
                            </Link>
                        )}

                        {/* Mobile menu button */}
                        <button
                            className="md:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden absolute top-12 left-0 right-0 bg-black/95 backdrop-blur-xl border-b border-[var(--border-color)]">
                        <div className="px-6 py-4 space-y-4">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className="block text-base text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {link.name}
                                </Link>
                            ))}
                            {isLoggedIn ? (
                                <>
                                    <Link
                                        href="/account"
                                        className="block text-base text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        Tài khoản
                                    </Link>
                                    {isAdmin && (
                                        <Link
                                            href="/api/admin/launch"
                                            className="block text-base text-[var(--text-primary)] hover:text-[var(--text-secondary)] transition-colors"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            Admin Panel
                                        </Link>
                                    )}
                                    <button
                                        onClick={() => signOut({ callbackUrl: '/' })}
                                        className="block text-base text-[var(--text-primary)] hover:text-[var(--text-secondary)] transition-colors"
                                    >
                                        Đăng xuất
                                    </button>
                                </>
                            ) : (
                                <Link
                                    href={`/login?callbackUrl=${encodeURIComponent(currentPath)}`}
                                    className="block text-base text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Đăng nhập
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </nav>

        </>
    );
}
