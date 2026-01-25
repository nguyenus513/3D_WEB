'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { getSupabase } from '@/lib/supabase/client';

const navItems = [
    {
        name: 'Tổng quan',
        href: '/account',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        name: 'Đơn hàng',
        href: '/account/orders',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
        ),
    },
    {
        name: 'Hồ sơ',
        href: '/account/profile',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        ),
    },
    {
        name: 'Địa chỉ',
        href: '/account/addresses',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
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
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('profiles')
                .select('name, full_name')
                .eq('email', session.user.email)
                .maybeSingle();

            if (!error && data) {
                setUserName(data.name || data.full_name || '');
            }
        } catch (err) {
            // Ignore errors - username is optional
            console.log('Failed to fetch userName:', err);
        }
    };

    const displayName = userName || session?.user?.name || session?.user?.email?.split('@')[0] || 'Người dùng';
    const displayEmail = session?.user?.email || '';
    const initial = displayName.charAt(0).toUpperCase();

    const handleLogout = () => {
        signOut({ callbackUrl: '/' });
    };

    return (
        <aside className="w-full lg:w-64 flex-shrink-0">
            {/* User info */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-5 border border-white/10 mb-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                        {initial}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-white font-semibold truncate">{displayName}</h3>
                        <p className="text-white/50 text-sm truncate">{displayEmail}</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                                flex items-center gap-3 px-5 py-4 transition-colors border-b border-white/5 last:border-b-0
                                ${isActive
                                    ? 'bg-white/5 text-white'
                                    : 'text-white/60 hover:text-white hover:bg-white/5'
                                }
                            `}
                        >
                            {item.icon}
                            <span className="font-medium">{item.name}</span>
                            {isActive && (
                                <svg className="w-4 h-4 ml-auto text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Logout */}
            <button
                onClick={handleLogout}
                className="w-full mt-4 flex items-center justify-center gap-2 px-5 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Đăng xuất
            </button>
        </aside>
    );
}
