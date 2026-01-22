'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAdminPath } from '@/hooks/useAdminPath';

interface MonthlyData {
    month: number;
    year: number;
    depositRevenue: number;
    deliveredRevenue: number;
    totalRevenue: number;
    orderCount: number;
    deliveredCount: number;
    pendingCount: number;
}

interface YearlyDataPoint {
    month: number;
    revenue: number;
    deliveredRevenue: number;
    depositRevenue: number;
}

interface OrderItem {
    id: string;
    order_code: string;
    total: number;
    deposit_amount: number;
    status: string;
    customer_name: string;
    created_at: string;
}

interface RevenueData {
    currentMonth: MonthlyData;
    previousMonth: { month: number; year: number; totalRevenue: number };
    percentChange: number;
    yearlyData: YearlyDataPoint[];
    orders: OrderItem[];
}

const monthNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

export default function RevenuePage() {
    const { adminRoot } = useAdminPath();
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [data, setData] = useState<RevenueData | null>(null);

    useEffect(() => {
        fetchData();
    }, [selectedMonth, selectedYear]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/revenue?month=${selectedMonth}&year=${selectedYear}`);
            const json = await res.json();
            if (!json.error) {
                setData(json);
            }
        } catch (error) {
            console.error('Error fetching revenue:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => value.toLocaleString('vi-VN') + 'đ';

    // Find max for chart scaling
    const maxRevenue = data ? Math.max(...data.yearlyData.map(d => d.revenue), 1) : 1;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href={adminRoot}
                        className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Phân tích Thu nhập</h1>
                        <p className="text-white/50 mt-1">Tháng {selectedMonth}/{selectedYear}</p>
                    </div>
                </div>

                {/* Month/Year Selector */}
                <div className="flex gap-3">
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="px-4 py-2.5 bg-[#1D1D1F] border border-white/10 rounded-xl text-white"
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                            <option key={m} value={m}>Tháng {m}</option>
                        ))}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="px-4 py-2.5 bg-[#1D1D1F] border border-white/10 rounded-xl text-white"
                    >
                        {[2024, 2025, 2026, 2027].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
            ) : data && (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total Revenue */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <span className="text-white/50 text-sm">Tổng thu T{selectedMonth}</span>
                            </div>
                            <p className="text-2xl font-bold text-green-400">{formatCurrency(data.currentMonth.totalRevenue)}</p>
                        </motion.div>

                        {/* Comparison */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${data.percentChange >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                                    <svg className={`w-5 h-5 ${data.percentChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={data.percentChange >= 0 ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
                                    </svg>
                                </div>
                                <span className="text-white/50 text-sm">So với T{data.previousMonth.month}</span>
                            </div>
                            <p className={`text-2xl font-bold ${data.percentChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {data.percentChange >= 0 ? '+' : ''}{data.percentChange}%
                            </p>
                        </motion.div>

                        {/* Orders Count */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                    </svg>
                                </div>
                                <span className="text-white/50 text-sm">Tổng đơn</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-400">{data.currentMonth.orderCount}</p>
                        </motion.div>

                        {/* Delivered Count */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-[#1D1D1F] rounded-2xl p-5 border border-white/10"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <span className="text-white/50 text-sm">Đã giao</span>
                            </div>
                            <p className="text-2xl font-bold text-cyan-400">{data.currentMonth.deliveredCount}</p>
                        </motion.div>
                    </div>

                    {/* Chart */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-[#1D1D1F] rounded-2xl p-6 border border-white/10"
                    >
                        <h2 className="text-lg font-semibold text-white mb-6">Thu nhập theo tháng ({selectedYear})</h2>

                        <div className="flex items-end justify-between gap-2 h-48">
                            {data.yearlyData.map((d, idx) => {
                                const height = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
                                const isSelected = d.month === selectedMonth;

                                return (
                                    <div
                                        key={d.month}
                                        className="flex-1 flex flex-col items-center gap-2 cursor-pointer group"
                                        onClick={() => setSelectedMonth(d.month)}
                                    >
                                        <div
                                            className={`w-full rounded-t-lg transition-all duration-300 ${isSelected
                                                    ? 'bg-gradient-to-t from-cyan-600 to-cyan-400'
                                                    : 'bg-white/10 group-hover:bg-white/20'
                                                }`}
                                            style={{ height: `${Math.max(height, 4)}%` }}
                                        />
                                        <span className={`text-xs ${isSelected ? 'text-cyan-400 font-medium' : 'text-white/40'}`}>
                                            {monthNames[idx]}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* Revenue Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Breakdown */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="bg-[#1D1D1F] rounded-2xl p-6 border border-white/10"
                        >
                            <h2 className="text-lg font-semibold text-white mb-4">Chi tiết thu nhập</h2>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                        <span className="text-white/70">Tiền đơn đã giao</span>
                                    </div>
                                    <span className="text-white font-medium">{formatCurrency(data.currentMonth.deliveredRevenue)}</span>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                        <span className="text-white/70">Tiền cọc đã thu</span>
                                    </div>
                                    <span className="text-white font-medium">{formatCurrency(data.currentMonth.depositRevenue)}</span>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-cyan-500" />
                                        <span className="text-cyan-400 font-medium">Tổng thu nhập</span>
                                    </div>
                                    <span className="text-cyan-400 font-bold text-lg">{formatCurrency(data.currentMonth.totalRevenue)}</span>
                                </div>
                            </div>
                        </motion.div>

                        {/* Recent Orders */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="bg-[#1D1D1F] rounded-2xl p-6 border border-white/10"
                        >
                            <h2 className="text-lg font-semibold text-white mb-4">Đơn hàng trong tháng</h2>

                            {data.orders.length === 0 ? (
                                <p className="text-white/50 text-center py-8">Chưa có đơn hàng</p>
                            ) : (
                                <div className="space-y-3 max-h-64 overflow-y-auto">
                                    {data.orders.map((order) => (
                                        <Link
                                            key={order.id}
                                            href={`${adminRoot}/orders/${order.id}`}
                                            className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                                        >
                                            <div>
                                                <p className="text-white font-mono text-sm">{order.order_code}</p>
                                                <p className="text-white/50 text-xs">{order.customer_name}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-white font-medium">{formatCurrency(order.status === 'delivered' ? order.total : order.deposit_amount)}</p>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                    {order.status === 'delivered' ? 'Đã giao' : 'Đặt cọc'}
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </div>
                </>
            )}
        </div>
    );
}
