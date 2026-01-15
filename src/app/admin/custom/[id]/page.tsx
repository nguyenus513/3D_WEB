'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { generateId } from '@/lib/generateId';

// Mock custom order data
const mockOrder = {
    id: 'CST-N9L3K6',
    sku: 'CST-K5J2H8M3',
    customer: 'Trần Thị B',
    email: 'tranthib@gmail.com',
    phone: '0912345678',
    status: 'processing',
    createdAt: '14/01/2026',
    description: 'Thiết kế mô hình chibi theo ảnh nhân vật game Genshin Impact',
    referenceImages: ['ref1.jpg', 'ref2.jpg'],
    size: '15cm height',
    material: 'Resin',
    quantity: 2,
    notes: 'Khách muốn có đế đứng kèm theo',
    estimatedPrice: 1200000,
    deposit: 600000,
    designStatus: 'approved', // pending, in_progress, approved, rejected
};

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    processing: 'bg-blue-500/20 text-blue-400',
    designing: 'bg-purple-500/20 text-purple-400',
    printing: 'bg-cyan-500/20 text-cyan-400',
    completed: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    designing: 'Đang thiết kế',
    printing: 'Đang in',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
};

const designStatusLabels: Record<string, string> = {
    pending: 'Chờ duyệt',
    in_progress: 'Đang thiết kế',
    approved: 'Đã duyệt',
    rejected: 'Bị từ chối',
};

export default function AdminCustomDetailPage() {
    const router = useRouter();
    const params = useParams();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({ ...mockOrder });

    const handleSave = async () => {
        setIsSaving(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Save custom order:', formData);
        setIsSaving(false);
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (confirm('Bạn có chắc muốn xóa đơn custom này?')) {
            console.log('Delete custom order:', params.id);
            router.push('/admin/custom');
        }
    };

    const regenerateSku = () => {
        setFormData({ ...formData, sku: generateId.skuCustom() });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/custom" className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Đơn Custom</h1>
                        <p className="text-white/50 mt-1">ID: {formData.id} • SKU: {formData.sku}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm ${statusColors[formData.status]}`}>
                        {statusLabels[formData.status]}
                    </span>
                    {isEditing ? (
                        <>
                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-xl border border-white/20 text-white/70 hover:text-white transition-colors">Hủy</button>
                            <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors disabled:opacity-50">
                                {isSaving ? 'Đang lưu...' : 'Lưu'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                Chỉnh sửa
                            </button>
                            <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 rounded-xl text-red-400 hover:bg-red-500/20 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                Xóa
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main info */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-5">
                    <h2 className="text-lg font-semibold text-white">Thông tin đơn hàng</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-white/50 text-sm block mb-1">Khách hàng</label>
                            <p className="text-white font-medium">{formData.customer}</p>
                            <p className="text-white/50 text-sm">{formData.email} • {formData.phone}</p>
                        </div>
                        <div>
                            <label className="text-white/50 text-sm block mb-1">SKU</label>
                            {isEditing ? (
                                <div className="flex gap-2">
                                    <input type="text" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none" />
                                    <button type="button" onClick={regenerateSku} className="px-3 py-2 bg-white/10 rounded-xl text-white/70 hover:text-white text-sm">Tạo mã</button>
                                </div>
                            ) : (
                                <p className="text-white font-mono">{formData.sku}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-white/50 text-sm block mb-1">Trạng thái</label>
                            {isEditing ? (
                                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none">
                                    {Object.entries(statusLabels).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            ) : (
                                <span className={`px-3 py-1 rounded-full text-sm ${statusColors[formData.status]}`}>{statusLabels[formData.status]}</span>
                            )}
                        </div>
                        <div>
                            <label className="text-white/50 text-sm block mb-1">Trạng thái thiết kế</label>
                            {isEditing ? (
                                <select value={formData.designStatus} onChange={(e) => setFormData({ ...formData, designStatus: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none">
                                    {Object.entries(designStatusLabels).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            ) : (
                                <span className="text-white">{designStatusLabels[formData.designStatus]}</span>
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-white/50 text-sm block mb-1">Mô tả yêu cầu</label>
                            {isEditing ? (
                                <textarea rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none resize-none" />
                            ) : (
                                <p className="text-white">{formData.description}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-white/50 text-sm block mb-1">Kích thước</label>
                            {isEditing ? (
                                <input type="text" value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none" />
                            ) : (
                                <p className="text-white">{formData.size}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-white/50 text-sm block mb-1">Số lượng</label>
                            {isEditing ? (
                                <input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none" />
                            ) : (
                                <p className="text-white">{formData.quantity}</p>
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-white/50 text-sm block mb-1">Ghi chú</label>
                            {isEditing ? (
                                <textarea rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none resize-none" />
                            ) : (
                                <p className="text-white/70">{formData.notes}</p>
                            )}
                        </div>
                    </div>

                    {/* Reference images */}
                    <div>
                        <label className="text-white/50 text-sm block mb-2">Ảnh tham khảo</label>
                        <div className="flex gap-3">
                            {formData.referenceImages.map((img, i) => (
                                <div key={i} className="w-24 h-24 rounded-xl bg-white/10 flex items-center justify-center text-white/30">
                                    📷 {i + 1}
                                </div>
                            ))}
                            {isEditing && (
                                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-white/40">
                                    <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Payment sidebar */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Thanh toán</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-white/50">Giá ước tính</span>
                            {isEditing ? (
                                <input type="number" value={formData.estimatedPrice} onChange={(e) => setFormData({ ...formData, estimatedPrice: parseInt(e.target.value) })} className="w-32 px-2 py-1 bg-[#0a0a0a] border border-white/20 rounded text-white text-right focus:outline-none" />
                            ) : (
                                <span className="text-white font-medium">{formData.estimatedPrice.toLocaleString('vi-VN')}đ</span>
                            )}
                        </div>
                        <div className="flex justify-between">
                            <span className="text-white/50">Đã cọc</span>
                            {isEditing ? (
                                <input type="number" value={formData.deposit} onChange={(e) => setFormData({ ...formData, deposit: parseInt(e.target.value) })} className="w-32 px-2 py-1 bg-[#0a0a0a] border border-white/20 rounded text-white text-right focus:outline-none" />
                            ) : (
                                <span className="text-green-400 font-medium">{formData.deposit.toLocaleString('vi-VN')}đ</span>
                            )}
                        </div>
                        <div className="border-t border-white/10 pt-3 flex justify-between">
                            <span className="text-white/50">Còn lại</span>
                            <span className="text-white font-bold">{(formData.estimatedPrice - formData.deposit).toLocaleString('vi-VN')}đ</span>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 text-sm text-white/50">
                        <p>Ngày tạo: {formData.createdAt}</p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
