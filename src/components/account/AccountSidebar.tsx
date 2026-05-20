'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Home, ShoppingBag, User, MapPin, ChevronRight, LogOut } from 'lucide-react';

const navItems = [
    { name: 'Tổng quan', href: '/account', icon: Home },
    { name: 'Đơn hàng', href: '/account/orders', icon: ShoppingBag },
    { name: 'Hồ sơ', href: '/account/profile', icon: User },
    { name: 'Địa chỉ', href: '/account/addresses', icon: MapPin },
];

export function AccountSidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [userName, setUserName] = useState('');

    useEffect(() => {
        if (session?.user?.email) {
            fetchUserName();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session]);

    const fetchUserName = async () => {
        if (!session?.user?.email) return;

        try {
            const response = await fetch('/api/profile');
            if (response.ok) {
                const data = await response.json();
                setUserName(data.full_name || '');
            }
        } catch (err) {
            console.log('Failed to fetch userName:', err);
        }
    };

    const displayName = userName || session?.user?.name || session?.user?.email?.split('@')[0] || 'Người dùng';
    const displayEmail = session?.user?.email || '';

    const handleLogout = () => {
        signOut({ callbackUrl: '/' });
    };

    return (
        <aside className="w-full lg:w-64 flex-shrink-0">
            {/* User info */}
            <div className="bg-[var(--material-glass)] backdrop-blur-xl rounded-2xl p-5 border border-[var(--border-color)] mb-4">
                <div>
                    <h3 className="text-[var(--text-primary)] font-semibold truncate">{displayName}</h3>
                    <p className="text-[var(--text-secondary)] text-sm truncate">{displayEmail}</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="bg-[var(--material-glass)] backdrop-blur-xl rounded-2xl border border-[var(--border-color)] overflow-hidden">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                                group flex items-center gap-3 px-5 py-4 transition-colors border-b border-[var(--border-color)] last:border-b-0
                                ${isActive
                                    ? 'bg-[var(--material-glass)] text-[var(--text-primary)]'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--material-glass)]'
                                }
                            `}
                        >
                            <span className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-colors ${isActive
                                ? 'bg-white text-black border-white'
                                : 'bg-white/10 text-white border-white/10 group-hover:bg-white/15'
                                }`}>
                                <Icon size={17} strokeWidth={1.75} />
                            </span>
                            <span className="font-medium">{item.name}</span>
                            {isActive && <ChevronRight size={16} className="ml-auto text-[var(--text-secondary)]" />}
                        </Link>
                    );
                })}
            </nav>

            {/* Logout */}
            <button
                onClick={handleLogout}
                className="w-full mt-4 flex items-center justify-center gap-2 px-5 py-3 bg-[var(--material-glass)] backdrop-blur-xl border border-[var(--border-color)] rounded-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--material-glass)] transition-colors"
            >
                <LogOut size={20} strokeWidth={1.5} />
                Đăng xuất
            </button>
        </aside>
    );
}
