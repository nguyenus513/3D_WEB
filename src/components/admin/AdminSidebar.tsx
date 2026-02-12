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
import { LayoutGrid, Box, Tag, Star, ClipboardList, Users, Settings, ChevronDown, Layers, LogOut } from 'lucide-react';

interface NavItem {
    name: string;
    path: string; // Relative path e.g. '/orders'
    icon: React.ReactNode;
    children?: { name: string; path: string }[];
}

const navConfig: NavItem[] = [
    {
        name: 'Dashboard',
        path: '',
        icon: <LayoutGrid size={20} strokeWidth={1.5} />,
    },
    {
        name: 'Sản phẩm',
        path: '/products',
        icon: <Box size={20} strokeWidth={1.5} />,
    },
    {
        name: 'Danh mục',
        path: '/categories',
        icon: <Tag size={20} strokeWidth={1.5} />,
    },
    {
        name: 'Nổi bật',
        path: '/featured',
        icon: <Star size={20} strokeWidth={1.5} />,
    },
    {
        name: 'Đơn hàng',
        path: '/orders',
        icon: <ClipboardList size={20} strokeWidth={1.5} />,
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
        icon: <Users size={20} strokeWidth={1.5} />,
    },
    {
        name: 'Cài đặt',
        path: '/settings',
        icon: <Settings size={20} strokeWidth={1.5} />,
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
            border-r border-white/5 bg-[#1D1D1F]
            lg:translate-x-0
        `,
            isOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
            {/* Logo */}
            <div className="p-6 border-b border-white/5">
                <Link href={adminRoot || '/sys_internal'} className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-2xl bg-white shadow-lg flex items-center justify-center transition-transform group-hover:scale-105 group-hover:rotate-3">
                        <Layers size={24} className="text-black" strokeWidth={2} />
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
                        : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]';

                    return (
                        <div key={fullHref}>
                            {hasChildren ? (
                                <>
                                    <button
                                        onClick={() => toggleExpand(item.name)}
                                        className={clsx(`
                                            w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300
                                            border border-transparent
                                        `, isActive ? 'bg-white/10 text-[var(--text-primary)] border-[var(--edge-light)]' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]')}
                                    >
                                        <span className={clsx("transition-transform duration-300", isActive && "scale-110")}>{item.icon}</span>
                                        <span className="font-semibold flex-1 text-left text-sm">{item.name}</span>
                                        <ChevronDown
                                            size={16}
                                            className={clsx("transition-transform duration-300", isExpanded ? 'rotate-180' : '')}
                                        />
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
                                        : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                    )}
                                >
                                    <span className={clsx("transition-transform duration-300", isActive && "scale-110")}>{item.icon}</span>
                                    <span className="font-semibold text-sm">{item.name}</span>
                                </Link>
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* User section */}
            <div className="p-4 border-t border-white/5">
                <button
                    onClick={() => {
                        // Clear 2FA cookie before signing out
                        document.cookie = '2fa-verified=; path=/; max-age=0';
                        signOut({ callbackUrl: '/login' });
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 transition-all cursor-pointer text-left border border-transparent hover:border-[var(--edge-light)] group"
                >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[#4F46E5] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                        <span className="font-bold text-sm">{session?.user?.name?.[0]?.toUpperCase() || 'A'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="text-[var(--text-primary)] text-sm font-bold block truncate">{session?.user?.name || 'Admin'}</span>
                        <span className="text-[var(--text-secondary)] text-xs block truncate font-medium">{session?.user?.email || ''}</span>
                    </div>
                    <LogOut size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors" />
                </button>
            </div>
        </aside>
    );
}
