'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { generateId } from '@/lib/generateId';

// Mock printing order data
const mockOrder = {
    id: 'PRT-M4R7S2',
    sku: 'RSN-A7K3M9B2',
    customer: 'Nguyễn Văn A',
    email: 'nguyenvana@gmail.com',
    phone: '0901234567',
    type: 'resin', // resin or fdm
    status: 'processing',
    createdAt: '15/01/2026',
    file: 'dragon_model.stl',
    fileSize: '12.5 MB',
    material: 'Resin Standard',
    color: 'Gray',
    quantity: 1,
    size: '150mm x 80mm x 200mm',
    notes: 'Cần in chi tiết cao, không cần support',
    estimatedPrice: 850000,
    deposit: 400000,
    remaining: 450000,
};

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    processing: 'bg-blue-500/20 text-blue-400',
    printing: 'bg-purple-500/20 text-purple-400',
    completed: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
};

const statusLabels: Record<string, string> = {
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    printing: 'Đang in',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
};

export default function AdminPrintingDetailPage() {
    const router = useRouter();
    const params = useParams();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({ ...mockOrder });

    const handleSave = async () => {
        setIsSaving(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Save printing order:', formData);
        setIsSaving(false);
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (confirm('Bạn có chắc muốn xóa đơn in 3D này?')) {
            console.log('Delete printing order:', params.id);
            router.push('/admin/printing');
        }
    };

    const regenerateSku = () => {
        const newSku = formData.type === 'resin' ? generateId.skuResin() : generateId.skuFdm();
        setFormData({ ...formData, sku: newSku });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/printing"
                        className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Đơn In 3D</h1>
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
                            <p className="text-white/50 text-sm">{formData.email}</p>
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
                            <label className="text-white/50 text-sm block mb-1">Loại in</label>
                            {isEditing ? (
                                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none">
                                    <option value="resin">Resin</option>
                                    <option value="fdm">FDM</option>
                                </select>
                            ) : (
                                <p className="text-white uppercase">{formData.type}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-white/50 text-sm block mb-1">Trạng thái</label>
                            {isEditing ? (
                                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none">
                                    <option value="pending">Chờ xử lý</option>
                                    <option value="processing">Đang xử lý</option>
                                    <option value="printing">Đang in</option>
                                    <option value="completed">Hoàn thành</option>
                                    <option value="cancelled">Đã hủy</option>
                                </select>
                            ) : (
                                <span className={`px-3 py-1 rounded-full text-sm ${statusColors[formData.status]}`}>{statusLabels[formData.status]}</span>
                            )}
                        </div>
                        <div>
                            <label className="text-white/50 text-sm block mb-1">File</label>
                            <p className="text-white">{formData.file}</p>
                            <p className="text-white/50 text-sm">{formData.fileSize}</p>
                        </div>
                        <div>
                            <label className="text-white/50 text-sm block mb-1">Kích thước</label>
                            <p className="text-white">{formData.size}</p>
                        </div>
                        <div>
                            <label className="text-white/50 text-sm block mb-1">Vật liệu</label>
                            {isEditing ? (
                                <input type="text" value={formData.material} onChange={(e) => setFormData({ ...formData, material: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none" />
                            ) : (
                                <p className="text-white">{formData.material}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-white/50 text-sm block mb-1">Màu sắc</label>
                            {isEditing ? (
                                <input type="text" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none" />
                            ) : (
                                <p className="text-white">{formData.color}</p>
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-white/50 text-sm block mb-1">Ghi chú</label>
                            {isEditing ? (
                                <textarea rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none resize-none" />
                            ) : (
                                <p className="text-white/70">{formData.notes}</p>
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
