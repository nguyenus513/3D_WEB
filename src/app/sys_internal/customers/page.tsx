'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAdminPath } from '@/hooks/useAdminPath';

interface Customer {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    customer_code: string | null;
    instagram_username: string | null;
    created_at: string;
    order_count?: number;
    total_spent?: number;
    last_order_date?: string;
}

export default function AdminCustomersPage() {
    const { adminRoot } = useAdminPath();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            const response = await fetch('/api/admin/customers');
            const data = await response.json();

            if (data.error) {
                console.error('Error fetching customers:', data.error);
                setLoading(false);
                return;
            }

            setCustomers(data.customers || []);
        } catch (error) {
            console.error('Error fetching customers:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredCustomers = customers.filter(customer =>
        customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">KhÃ¡ch hÃ ng</h1>
                    <p className="text-[var(--text-secondary)] mt-1">
                        {loading ? 'Äang táº£i...' : `${customers.length} khÃ¡ch hÃ ng`}
                    </p>
                </div>
                <button
                    onClick={fetchCustomers}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--material-panel)] border border-[var(--border-color)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    LÃ m má»›i
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    placeholder="TÃ¬m theo tÃªn, email, SÄT..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--material-panel)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                />
            </div>

            {/* Customers table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] overflow-hidden"
            >
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-[var(--text-secondary)]">Äang táº£i khÃ¡ch hÃ ng...</p>
                    </div>
                ) : filteredCustomers.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-[var(--text-secondary)]">ChÆ°a cÃ³ khÃ¡ch hÃ ng nÃ o</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[var(--border-color)]">
                                <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">KhÃ¡ch hÃ ng</th>
                                <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Instagram</th>
                                <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">LiÃªn há»‡</th>
                                <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">MÃ£ KH</th>
                                <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">ÄÆ¡n hÃ ng</th>
                                <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Tá»•ng chi tiÃªu</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.map((customer) => (
                                <tr
                                    key={customer.id}
                                    className="border-b border-[var(--border-color)] hover:bg-[var(--material-glass)] transition-colors cursor-pointer"
                                    onClick={() => window.location.href = `${adminRoot}/customers/${customer.id}`}
                                >
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-[var(--material-glass)] flex items-center justify-center text-[var(--text-primary)] font-medium">
                                                {customer.name?.charAt(0) || '?'}
                                            </div>
                                            <span className="text-[var(--text-primary)] font-medium">{customer.name || customer.email?.split('@')[0] || 'ChÆ°a Ä‘áº·t tÃªn'}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        {customer.instagram_username ? (
                                            <a
                                                href={`https://instagram.com/${customer.instagram_username}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-pink-400 hover:underline flex items-center gap-1"
                                            >
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                                </svg>
                                                @{customer.instagram_username}
                                            </a>
                                        ) : (
                                            <span className="text-[var(--text-tertiary)]">-</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div>
                                            <p className="text-[var(--text-secondary)]">{customer.email || '-'}</p>
                                            <p className="text-[var(--text-secondary)] text-sm">{customer.phone || '-'}</p>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <code className="text-[var(--text-secondary)] text-sm bg-[var(--material-glass)] px-2 py-1 rounded">
                                            {customer.customer_code || '-'}
                                        </code>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className="px-3 py-1 rounded-full bg-[var(--material-glass)] text-[var(--text-primary)] text-sm">
                                            {customer.order_count || 0} Ä‘Æ¡n
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-[var(--text-primary)] font-medium">
                                        {(customer.total_spent || 0).toLocaleString('vi-VN')}Ä‘
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </motion.div>
        </div>
    );
}

