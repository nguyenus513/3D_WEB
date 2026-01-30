'use client';

/**
 * AdminSidebar (Visionary Spatial Edition)
 * 
 * Features:
 * - Vertical Prism Style: Uses --material-panel for a glass effect.
 * - Liquid Hover: Nav items flow with magnetic physics.
 * - Refractive Active State: Active items look like etched glass.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, signOut } from 'next-auth/react';
import { clsx } from 'clsx';

interface NavItem {
    name: string;
    path: string; // Relative path e.g. '/orders'
    icon: React.ReactNode;
    children?: { name: string; path: string }[];
}

const navConfig: NavItem[] = [
    {
        name: 'Dashboard',
        path: '', // Root
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
        ),
    },
    {
        name: 'Sản phẩm',
        path: '/products',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        ),
    },
    {
        name: 'Danh mục',
        path: '/categories',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
        ),
    },
    {
        name: 'Nổi bật',
        path: '/featured',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
        ),
    },
    {
        name: 'Đơn hàng',
        path: '/orders',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
        ),
        children: [
            { name: 'Tất cả', path: '/orders' },
            { name: 'Sản phẩm', path: '/orders/products' },
            { name: 'Custom', path: '/orders/custom' },
            { name: 'In 3D', path: '/orders/printing' },
        ],
    },
    {
        name: 'Khách hàng',
        path: '/customers',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        ),
    },
    {
        name: 'Cài đặt',
        path: '/settings',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
];

export function AdminSidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [expandedItems, setExpandedItems] = useState<string[]>(['Khách hàng']);
    const [adminRoot, setAdminRoot] = useState('');

    useEffect(() => {
        if (pathname) {
            const parts = pathname.split('/');
            if (parts.length >= 2) {
                const rootSegment = parts[1];
                if (rootSegment && rootSegment.length > 20) {
                    setAdminRoot(`/${rootSegment}`);
                }
            }
        }
    }, [pathname]);

    const effectiveRoot = adminRoot || '/sys_internal';

    const toggleExpand = (name: string) => {
        setExpandedItems(prev =>
            prev.includes(name)
                ? prev.filter(item => item !== name)
                : [...prev, name]
        );
    };

    return (
        <aside className={clsx(`
            fixed left-0 top-0 h-screen w-64 z-50 flex flex-col
            transform transition-transform duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)
            border-r border-[var(--edge-light)]
            lg:translate-x-0
            glass-panel
        `,
            isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
            style={{
                background: 'var(--material-panel)',
                backdropFilter: 'blur(var(--blur-panel)) saturate(var(--saturate-panel))'
            }}>
            {/* Logo */}
            <div className="p-6 border-b border-[var(--edge-shade)]">
                <Link href={adminRoot || '/sys_internal'} className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-2xl bg-white shadow-lg flex items-center justify-center transition-transform group-hover:scale-105 group-hover:rotate-3">
                        <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <div>
                        <span className="text-[var(--text-primary)] font-bold tracking-tight text-lg block">Miniver</span>
                        <span className="text-[var(--text-secondary)] text-xs block font-medium">3D Lab Admin</span>
                    </div>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                {navConfig.map((item) => {
                    const fullHref = `${effectiveRoot}${item.path}`;
                    const isActive = pathname === fullHref ||
                        (item.path !== '' && pathname.startsWith(fullHref));
                    const isExpanded = expandedItems.includes(item.name);
                    const hasChildren = item.children && item.children.length > 0;

                    const activeClass = isActive
                        ? 'bg-[var(--color-accent)] text-white shadow-md'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--material-glass)] hover:text-[var(--text-primary)]';

                    return (
                        <div key={fullHref}>
                            {hasChildren ? (
                                <>
                                    <button
                                        onClick={() => toggleExpand(item.name)}
                                        className={clsx(`
                                            w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300
                                            border border-transparent
                                        `, isActive ? 'bg-white/10 text-[var(--text-primary)] border-[var(--edge-light)]' : 'text-[var(--text-secondary)] hover:bg-[var(--material-glass)] hover:text-[var(--text-primary)]')}
                                    >
                                        <span className={clsx("transition-transform duration-300", isActive && "scale-110")}>{item.icon}</span>
                                        <span className="font-semibold flex-1 text-left text-sm">{item.name}</span>
                                        <svg
                                            className={clsx("w-4 h-4 transition-transform duration-300", isExpanded ? 'rotate-180' : '')}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="pl-4 py-2 space-y-1 relative">
                                                    {/* Guide line */}
                                                    <div className="absolute left-6 top-2 bottom-2 w-px bg-[var(--edge-shade)]" />

                                                    {item.children?.map((child) => {
                                                        const childHref = `${effectiveRoot}${child.path}`;
                                                        const isChildActive = pathname === childHref.split('?')[0];
                                                        return (
                                                            <Link
                                                                key={childHref}
                                                                href={childHref}
                                                                className={clsx(`
                                                                    block pl-8 pr-4 py-2.5 rounded-xl text-sm transition-all relative
                                                                    font-medium
                                                                `, isChildActive
                                                                    ? 'text-[var(--color-accent)] bg-[var(--color-accent-glow)]'
                                                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                )}
                                                            >
                                                                {child.name}
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </>
                            ) : (
                                <Link
                                    href={fullHref}
                                    className={clsx(`
                                        flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300
                                        border border-transparent
                                    `, isActive
                                        ? 'bg-[var(--color-accent)] text-white shadow-[var(--shadow-2)]'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--material-glass)] hover:text-[var(--text-primary)]'
                                    )}
                                >
                                    <span className={clsx("transition-transform duration-300", isActive && "scale-110")}>{item.icon}</span>
                                    <span className="font-semibold text-sm">{item.name}</span>
                                    {isActive && (
                                        <motion.div
                                            layoutId="sidebar-active-glow"
                                            className="absolute inset-0 rounded-2xl bg-white/20 blur-lg -z-10"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                </Link>
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* User section */}
            <div className="p-4 border-t border-[var(--edge-shade)]">
                <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-[var(--material-glass)] transition-all cursor-pointer text-left border border-transparent hover:border-[var(--edge-light)] group"
                >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[#4F46E5] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                        <span className="font-bold text-sm">{session?.user?.name?.[0]?.toUpperCase() || 'A'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="text-[var(--text-primary)] text-sm font-bold block truncate">{session?.user?.name || 'Admin'}</span>
                        <span className="text-[var(--text-secondary)] text-xs block truncate font-medium">{session?.user?.email || ''}</span>
                    </div>
                    <svg className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
            </div>
        </aside>
    );
}
