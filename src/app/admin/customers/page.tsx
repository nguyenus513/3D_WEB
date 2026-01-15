'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase/client';

interface Customer {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    customer_code: string | null;
    created_at: string;
    order_count?: number;
    total_spent?: number;
    last_order_date?: string;
}

export default function AdminCustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        const supabase = getSupabase();

        // Get all customer profiles with order stats
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'customer')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching customers:', error);
            setLoading(false);
            return;
        }

        // Get order stats for each customer
        const customersWithStats = await Promise.all(
            (profiles || []).map(async (profile: { id: string; full_name: string | null; email: string | null; phone: string | null; customer_code: string | null; created_at: string }) => {
                const { data: orders } = await supabase
                    .from('orders')
                    .select('total, created_at')
                    .eq('user_id', profile.id);

                const orderCount = orders?.length || 0;
                const totalSpent = orders?.reduce((sum: number, o: { total: number }) => sum + Number(o.total), 0) || 0;
                const lastOrderDate = orders?.[0]?.created_at;

                return {
                    ...profile,
                    order_count: orderCount,
                    total_spent: totalSpent,
                    last_order_date: lastOrderDate,
                };
            })
        );

        setCustomers(customersWithStats);
        setLoading(false);
    };

    const filteredCustomers = customers.filter(customer =>
        customer.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Khách hàng</h1>
                    <p className="text-white/50 mt-1">
                        {loading ? 'Đang tải...' : `${customers.length} khách hàng`}
                    </p>
                </div>
                <button
                    onClick={fetchCustomers}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1D1D1F] border border-white/10 rounded-xl text-white/70 hover:text-white"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Làm mới
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    placeholder="Tìm theo tên, email, SĐT..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#1D1D1F] border border-white/10 rounded-xl text-white placeholder:text-white/40"
                />
            </div>

            {/* Customers table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 overflow-hidden"
            >
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-white/50">Đang tải khách hàng...</p>
                    </div>
                ) : filteredCustomers.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-white/50">Chưa có khách hàng nào</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Khách hàng</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Liên hệ</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Mã KH</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Đơn hàng</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Tổng chi tiêu</th>
                                <th className="text-right text-white/50 text-sm font-medium px-5 py-4">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.map((customer) => (
                                <tr key={customer.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-medium">
                                                {customer.full_name?.charAt(0) || '?'}
                                            </div>
                                            <span className="text-white font-medium">{customer.full_name || 'Chưa đặt tên'}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div>
                                            <p className="text-white/70">{customer.email || '-'}</p>
                                            <p className="text-white/50 text-sm">{customer.phone || '-'}</p>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <code className="text-white/60 text-sm bg-white/5 px-2 py-1 rounded">
                                            {customer.customer_code || '-'}
                                        </code>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className="px-3 py-1 rounded-full bg-white/10 text-white text-sm">
                                            {customer.order_count || 0} đơn
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-white font-medium">
                                        {(customer.total_spent || 0).toLocaleString('vi-VN')}đ
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link
                                                href={`/admin/customers/${customer.id}`}
                                                className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            </Link>
                                        </div>
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
