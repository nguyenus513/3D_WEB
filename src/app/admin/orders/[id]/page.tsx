'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Mock order data
const mockOrder = {
    id: '#1001',
    customer: {
        name: 'Nguyễn Văn A',
        email: 'nguyenvana@gmail.com',
        phone: '0901234567',
    },
    shipping: {
        recipient: 'Nguyễn Văn A',
        phone: '0901234567',
        address: '123 Nguyễn Văn Linh, Quận 7, TP.HCM',
    },
    items: [
        { name: 'Custom Couple Figure', qty: 1, price: 650000, size: 'M (15cm)' },
        { name: 'Accessory Set', qty: 1, price: 200000, size: 'S (5cm)' },
    ],
    subtotal: 850000,
    shipping_fee: 30000,
    total: 880000,
    deposit: 440000,
    remaining: 440000,
    type: 'custom',
    status: 'processing',
    created_at: '15/01/2026 10:30',
    timeline: [
        { status: 'pending', label: 'Đặt hàng', date: '15/01/2026 10:30', completed: true },
        { status: 'paid', label: 'Đã thanh toán cọc', date: '15/01/2026 10:35', completed: true },
        { status: 'processing', label: 'Đang sản xuất', date: '15/01/2026 14:00', completed: true },
        { status: 'review', label: 'Gửi ảnh xác nhận', date: '', completed: false },
        { status: 'shipping', label: 'Đang giao hàng', date: '', completed: false },
        { status: 'completed', label: 'Hoàn thành', date: '', completed: false },
    ],
    tracking_code: '',
};

const statusActions = [
    { key: 'processing', label: 'Đang sản xuất', color: 'bg-blue-500' },
    { key: 'review', label: 'Gửi ảnh xác nhận', color: 'bg-purple-500' },
    { key: 'shipping', label: 'Đang giao hàng', color: 'bg-orange-500' },
    { key: 'completed', label: 'Hoàn thành', color: 'bg-green-500' },
];

export default function AdminOrderDetailPage() {
    const params = useParams();
    const [order, setOrder] = useState(mockOrder);
    const [trackingCode, setTrackingCode] = useState('');
    const [showTrackingModal, setShowTrackingModal] = useState(false);

    const updateStatus = (newStatus: string) => {
        setOrder({ ...order, status: newStatus });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/orders"
                        className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Đơn hàng {order.id}</h1>
                        <p className="text-white/50 mt-1">Tạo lúc {order.created_at}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors">
                        In hóa đơn
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Timeline */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-6">Trạng thái đơn hàng</h2>
                        <div className="relative">
                            {order.timeline.map((step, index) => (
                                <div key={step.status} className="flex gap-4 pb-6 last:pb-0">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-4 h-4 rounded-full ${step.completed ? 'bg-white' : 'bg-white/20'}`} />
                                        {index < order.timeline.length - 1 && (
                                            <div className={`w-0.5 flex-1 ${step.completed ? 'bg-white/50' : 'bg-white/10'}`} />
                                        )}
                                    </div>
                                    <div className="flex-1 pb-2">
                                        <p className={`font-medium ${step.completed ? 'text-white' : 'text-white/40'}`}>
                                            {step.label}
                                        </p>
                                        {step.date && (
                                            <p className="text-white/50 text-sm">{step.date}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Status actions */}
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <h3 className="text-white/70 text-sm mb-3">Cập nhật trạng thái</h3>
                            <div className="flex flex-wrap gap-2">
                                {statusActions.map((action) => (
                                    <button
                                        key={action.key}
                                        onClick={() => {
                                            if (action.key === 'shipping') {
                                                setShowTrackingModal(true);
                                            } else {
                                                updateStatus(action.key);
                                            }
                                        }}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${order.status === action.key
                                                ? 'bg-white text-black'
                                                : 'bg-white/10 text-white hover:bg-white/20'
                                            }`}
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Order items */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-4">Sản phẩm</h2>
                        <div className="space-y-4">
                            {order.items.map((item, index) => (
                                <div key={index} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                                    <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center">
                                        <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-white font-medium">{item.name}</p>
                                        <p className="text-white/50 text-sm">{item.size} × {item.qty}</p>
                                    </div>
                                    <p className="text-white font-medium">{item.price.toLocaleString('vi-VN')}đ</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Customer */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-4">Khách hàng</h2>
                        <div className="space-y-3">
                            <p className="text-white">{order.customer.name}</p>
                            <p className="text-white/70">{order.customer.email}</p>
                            <p className="text-white/70">{order.customer.phone}</p>
                        </div>
                    </motion.div>

                    {/* Shipping */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-4">Địa chỉ giao hàng</h2>
                        <div className="space-y-2">
                            <p className="text-white">{order.shipping.recipient}</p>
                            <p className="text-white/70">{order.shipping.phone}</p>
                            <p className="text-white/50">{order.shipping.address}</p>
                        </div>
                    </motion.div>

                    {/* Payment */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-4">Thanh toán</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-white/70">Tổng sản phẩm</span>
                                <span className="text-white">{order.subtotal.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/70">Phí ship</span>
                                <span className="text-white">{order.shipping_fee.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="border-t border-white/10 pt-3 flex justify-between">
                                <span className="text-white font-medium">Tổng cộng</span>
                                <span className="text-white font-bold">{order.total.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex justify-between text-green-400">
                                <span>Đã cọc</span>
                                <span>{order.deposit.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex justify-between text-yellow-400">
                                <span>Còn lại</span>
                                <span>{order.remaining.toLocaleString('vi-VN')}đ</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Tracking modal */}
            {showTrackingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-xl font-bold text-white mb-4">Nhập mã vận đơn</h2>
                        <input
                            type="text"
                            value={trackingCode}
                            onChange={(e) => setTrackingCode(e.target.value)}
                            placeholder="VD: VTP123456789"
                            className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    updateStatus('shipping');
                                    setShowTrackingModal(false);
                                }}
                                className="flex-1 py-3 rounded-xl bg-white text-black font-medium"
                            >
                                Xác nhận
                            </button>
                            <button
                                onClick={() => setShowTrackingModal(false)}
                                className="px-6 py-3 rounded-xl border border-white/20 text-white/70"
                            >
                                Hủy
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
