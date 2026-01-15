'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Mock customers data
const customers = [
    { id: 1, name: 'Nguyễn Văn A', email: 'nguyenvana@gmail.com', phone: '0901234567', orders: 5, totalSpent: 2850000, lastOrder: '15/01/2026' },
    { id: 2, name: 'Trần Thị B', email: 'tranthib@gmail.com', phone: '0912345678', orders: 3, totalSpent: 1050000, lastOrder: '14/01/2026' },
    { id: 3, name: 'Lê Văn C', email: 'levanc@gmail.com', phone: '0923456789', orders: 8, totalSpent: 4200000, lastOrder: '14/01/2026' },
    { id: 4, name: 'Phạm Thị D', email: 'phamthid@gmail.com', phone: '0934567890', orders: 2, totalSpent: 900000, lastOrder: '13/01/2026' },
    { id: 5, name: 'Hoàng Văn E', email: 'hoangvane@gmail.com', phone: '0945678901', orders: 12, totalSpent: 6500000, lastOrder: '13/01/2026' },
];

export default function AdminCustomersPage() {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCustomers = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Khách hàng</h1>
                    <p className="text-white/50 mt-1">Quản lý thông tin khách hàng</p>
                </div>
                <div className="flex items-center gap-2 text-white/50 text-sm">
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    {customers.length} khách hàng
                </div>
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
                    className="w-full pl-10 pr-4 py-2.5 bg-[#1D1D1F] border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
            </div>

            {/* Customers table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 overflow-hidden"
            >
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Khách hàng</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Liên hệ</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Đơn hàng</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Tổng chi tiêu</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Lần mua cuối</th>
                            <th className="text-right text-white/50 text-sm font-medium px-5 py-4">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCustomers.map((customer) => (
                            <tr key={customer.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-medium">
                                            {customer.name.charAt(0)}
                                        </div>
                                        <span className="text-white font-medium">{customer.name}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <div>
                                        <p className="text-white/70">{customer.email}</p>
                                        <p className="text-white/50 text-sm">{customer.phone}</p>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <span className="px-3 py-1 rounded-full bg-white/10 text-white text-sm">
                                        {customer.orders} đơn
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-white font-medium">
                                    {customer.totalSpent.toLocaleString('vi-VN')}đ
                                </td>
                                <td className="px-5 py-4 text-white/50">
                                    {customer.lastOrder}
                                </td>
                                <td className="px-5 py-4">
                                    <div className="flex items-center justify-end gap-2">
                                        <button className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </motion.div>
        </div>
    );
}
