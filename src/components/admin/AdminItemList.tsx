'use client';

/**
 * AdminItemList - Displays SUB-ORDERS (đơn con) for business-specific views
 * 
 * Used for:
 * - /orders/products → item_type = 'product'
 * - /orders/custom → item_type = 'custom'
 * - /orders/printing → item_type = 'printing'
 * 
 * Each row is a SUB-ORDER with cart_order_code format: CARTCODE_ITEMCODE
 * NOT a cart/master order!
 */

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Production status for sub-orders
const productionStatusTabs = [
    { key: 'all', label: 'Tất cả' },
    { key: 'waiting', label: 'Chờ xử lý' },
    { key: 'designing', label: 'Đang thiết kế' },
    { key: 'approved', label: 'Đã duyệt' },
    { key: 'printing', label: 'Đang in' },
    { key: 'quality_check', label: 'Kiểm tra' },
    { key: 'done', label: 'Hoàn thành' },
];

const statusLabels: Record<string, string> = {
    waiting: 'Chờ xử lý',
    designing: 'Đang thiết kế',
    pending_approval: 'Chờ duyệt',
    approved: 'Đã duyệt',
    printing: 'Đang in',
    quality_check: 'Kiểm tra CL',
    done: 'Hoàn thành',
    cancelled: 'Đã hủy',
};

const statusColors: Record<string, string> = {
    waiting: 'bg-yellow-500/20 text-yellow-400',
    designing: 'bg-pink-500/20 text-pink-400',
    pending_approval: 'bg-orange-500/20 text-orange-400',
    approved: 'bg-blue-500/20 text-blue-400',
    printing: 'bg-purple-500/20 text-purple-400',
    quality_check: 'bg-cyan-500/20 text-cyan-400',
    done: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
};

const itemTypeLabels: Record<string, string> = {
    product: 'Sản phẩm',
    custom: 'Custom',
    printing: 'In 3D',
};

interface AdminItemListProps {
    itemType: 'product' | 'custom' | 'printing';
    title: string;
    subtitle?: string;
}

interface OrderItem {
    id: string;
    cart_order_code: string;
    cart_code: string;
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    item_type: string;
    production_status: string;
    print_tech?: string;
    color?: string;
    material?: string;
    created_at: string;
    order?: {
        id: string;
        cart_code: string;
        status: string;
        payment_status: string;
    };
    customer?: {
        id: string;
        name: string;
        email: string;
        phone: string;
    } | null;
}

export function AdminItemList({ itemType, title, subtitle }: AdminItemListProps) {
    const pathname = usePathname();
    const [items, setItems] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeStatus, setActiveStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Detect dynamic admin root path
    const pathParts = pathname.split('/');
    const adminRoot = pathParts.length >= 2 && pathParts[1].length >= 40 ? `/${pathParts[1]}` : '/sys_internal';

    useEffect(() => {
        fetchItems();
    }, [itemType, activeStatus]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const statusParam = activeStatus !== 'all' ? `&status=${activeStatus}` : '';
            const response = await fetch(`/api/admin/items?type=${itemType}${statusParam}`);
            const json = await response.json();

            if (!json.success || json.error) {
                console.error('Error fetching items:', json.error || 'Unknown error');
                setItems([]);
            } else {
                setItems(json.data || []);
            }
        } catch (error) {
            console.error('Error fetching items:', error);
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (itemId: string, newStatus: string) => {
        try {
            const res = await fetch(`/api/admin/items/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ production_status: newStatus }),
            });
            const json = await res.json();

            if (json.success) {
                setItems(items.map(item =>
                    item.id === itemId ? { ...item, production_status: newStatus } : item
                ));
            } else {
                console.error('Error updating status:', json.error);
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    // Filter items
    const filteredItems = items.filter(item => {
        const matchesSearch =
            item.cart_order_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.cart_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesSearch;
    });

    const getStatusCount = (status: string) => {
        if (status === 'all') return items.length;
        return items.filter(i => i.production_status === status).length;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{title}</h1>
                    <p className="text-white/50 mt-1">
                        {loading ? 'Đang tải...' : subtitle || `${filteredItems.length} đơn con`}
                    </p>
                </div>
                <button
                    onClick={fetchItems}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#1D1D1F] border border-white/10 rounded-xl text-white/70 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Làm mới
                </button>
            </div>

            {/* Production Status Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {productionStatusTabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveStatus(tab.key)}
                        className={`
                            flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all
                            ${activeStatus === tab.key
                                ? 'bg-white text-black'
                                : 'bg-[#1D1D1F] text-white/70 hover:text-white border border-white/10'
                            }
                        `}
                    >
                        {tab.label}
                        <span className={`px-1.5 py-0.5 rounded text-xs ${activeStatus === tab.key ? 'bg-black/10' : 'bg-white/10'}`}>
                            {getStatusCount(tab.key)}
                        </span>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    placeholder="Tìm theo mã đơn con hoặc khách hàng..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 bg-[#1D1D1F] border border-white/10 rounded-xl text-white placeholder:text-white/40 text-sm"
                />
            </div>

            {/* Items Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 overflow-hidden"
            >
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-white/50">Không có đơn con nào</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Mã đơn con</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Thuộc đơn</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Sản phẩm</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Khách hàng</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Thông số</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Trạng thái</th>
                                    <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Ngày tạo</th>
                                    <th className="px-5 py-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-5 py-4">
                                            <span className="text-white font-mono font-medium">
                                                {item.cart_order_code}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <Link
                                                href={`${adminRoot}/orders/${item.order?.id}`}
                                                className="text-blue-400 hover:underline"
                                            >
                                                {item.cart_code}
                                            </Link>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div>
                                                <span className="text-white block">{item.name}</span>
                                                <span className="text-white/50 text-sm">x{item.quantity}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-white">
                                                {item.customer?.name || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            {itemType === 'printing' && (
                                                <div className="text-white/70 text-sm space-y-0.5">
                                                    {item.print_tech && <div>Tech: {item.print_tech}</div>}
                                                    {item.color && <div>Màu: {item.color}</div>}
                                                    {item.material && <div>Vật liệu: {item.material}</div>}
                                                </div>
                                            )}
                                            {itemType !== 'printing' && (
                                                <span className="text-white/50 text-sm">-</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[item.production_status] || 'bg-white/10 text-white/50'}`}>
                                                {statusLabels[item.production_status] || item.production_status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-white/70 text-sm">
                                                {new Date(item.created_at).toLocaleString('vi-VN', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Action buttons based on status */}
                                                {item.production_status === 'waiting' && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(item.id, 'designing')}
                                                        className="px-3 py-1.5 bg-pink-500/20 text-pink-400 rounded-lg text-sm hover:bg-pink-500/30"
                                                    >
                                                        Bắt đầu
                                                    </button>
                                                )}
                                                {item.production_status === 'designing' && itemType === 'printing' && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(item.id, 'printing')}
                                                        className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm hover:bg-purple-500/30"
                                                    >
                                                        In
                                                    </button>
                                                )}
                                                {item.production_status === 'printing' && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(item.id, 'quality_check')}
                                                        className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30"
                                                    >
                                                        Kiểm tra
                                                    </button>
                                                )}
                                                {item.production_status === 'quality_check' && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(item.id, 'done')}
                                                        className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30"
                                                    >
                                                        Xong
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
