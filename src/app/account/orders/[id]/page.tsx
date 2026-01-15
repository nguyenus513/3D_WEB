'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Mock order data
const mockOrder = {
    id: '#1001',
    status: 'processing',
    type: 'custom',
    created_at: '15/01/2026 10:30',
    items: [
        { name: 'Custom Couple Figure', qty: 1, price: 650000, size: 'M (15cm)', image: '🎭' },
        { name: 'Accessory Set', qty: 1, price: 200000, size: 'S (5cm)', image: '✨' },
    ],
    subtotal: 850000,
    shipping_fee: 30000,
    total: 880000,
    deposit: 440000,
    remaining: 440000,
    shipping: {
        recipient: 'Nguyễn Văn A',
        phone: '0901234567',
        address: '123 Nguyễn Văn Linh, Quận 7, TP.HCM',
    },
    tracking: {
        code: 'VTP123456789',
        carrier: 'Viettel Post',
        url: 'https://viettelpost.vn/tracking',
    },
    timeline: [
        { status: 'ordered', label: 'Đặt hàng thành công', date: '15/01/2026 10:30', completed: true },
        { status: 'paid', label: 'Đã thanh toán cọc 50%', date: '15/01/2026 10:35', completed: true },
        { status: 'processing', label: 'Đang sản xuất', date: '15/01/2026 14:00', completed: true },
        { status: 'review', label: 'Gửi ảnh xác nhận', date: '', completed: false },
        { status: 'shipping', label: 'Đang giao hàng', date: '', completed: false },
        { status: 'completed', label: 'Hoàn thành', date: '', completed: false },
    ],
};

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    processing: 'bg-blue-500/20 text-blue-400',
    shipping: 'bg-orange-500/20 text-orange-400',
    completed: 'bg-green-500/20 text-green-400',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ xử lý',
    processing: 'Đang sản xuất',
    shipping: 'Đang giao hàng',
    completed: 'Hoàn thành',
};

export default function AccountOrderDetailPage() {
    const params = useParams();
    const order = mockOrder;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/account/orders"
                        className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Đơn hàng {order.id}</h1>
                        <p className="text-white/50 mt-1">Đặt lúc {order.created_at}</p>
                    </div>
                </div>
                <span className={`px-4 py-2 rounded-xl text-sm font-medium ${statusColors[order.status]}`}>
                    {statusLabels[order.status]}
                </span>
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
                                    <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                                        {item.image}
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

                    {/* Tracking */}
                    {order.tracking.code && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                        >
                            <h2 className="text-lg font-semibold text-white mb-4">Theo dõi vận chuyển</h2>
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                                <div>
                                    <p className="text-white/50 text-sm">Mã vận đơn ({order.tracking.carrier})</p>
                                    <p className="text-white font-medium mt-1">{order.tracking.code}</p>
                                </div>
                                <a
                                    href={order.tracking.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
                                >
                                    Theo dõi
                                </a>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
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
                                <span className="text-white/70">Tạm tính</span>
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

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-3"
                    >
                        <button className="w-full py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors">
                            Liên hệ hỗ trợ
                        </button>
                        <button className="w-full py-3 rounded-xl border border-white/20 text-white/70 hover:text-white transition-colors">
                            Hủy đơn hàng
                        </button>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
