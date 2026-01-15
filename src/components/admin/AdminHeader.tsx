'use client';

import { useState } from 'react';
import Link from 'next/link';

export function AdminHeader() {
    const [showNotifications, setShowNotifications] = useState(false);

    return (
        <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/10">
            <div className="flex items-center justify-between h-16 px-6">
                {/* Search */}
                <div className="flex-1 max-w-md">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Tìm kiếm..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                        />
                    </div>
                </div>

                {/* Right section */}
                <div className="flex items-center gap-3">
                    {/* Notifications */}
                    <div className="relative">
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="relative p-2.5 rounded-xl hover:bg-white/5 transition-colors"
                        >
                            <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {/* Badge */}
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-white rounded-full" />
                        </button>

                        {/* Dropdown */}
                        {showNotifications && (
                            <div className="absolute right-0 mt-2 w-80 bg-[#1D1D1F] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                                <div className="p-4 border-b border-white/10">
                                    <h3 className="text-white font-semibold">Thông báo</h3>
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                                    </svg>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white text-sm">Đơn hàng mới #{1000 + i}</p>
                                                    <p className="text-white/50 text-xs mt-0.5">2 phút trước</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-3">
                                    <Link href="/admin/notifications" className="block text-center text-sm text-white/70 hover:text-white transition-colors">
                                        Xem tất cả
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Back to site */}
                    <Link
                        href="/"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-all"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span className="text-sm">Xem site</span>
                    </Link>
                </div>
            </div>
        </header>
    );
}
