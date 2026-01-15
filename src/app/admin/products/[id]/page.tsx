'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

const categories = ['Figure', 'Bust', 'Trophy', 'Custom', 'Accessory'];

// Mock product data
const mockProduct = {
    id: 1,
    name: 'Dragon Figure',
    category: 'Figure',
    price: 350000,
    description: 'Mô hình rồng chi tiết cao, được thiết kế và in 3D chất lượng cao.',
    stock: 15,
    sizes: [
        { name: 'S', price: '250000' },
        { name: 'M', price: '350000' },
        { name: 'L', price: '450000' },
    ],
};

export default function AdminProductEditPage() {
    const router = useRouter();
    const params = useParams();
    const [formData, setFormData] = useState({
        name: mockProduct.name,
        category: mockProduct.category,
        price: mockProduct.price.toString(),
        description: mockProduct.description,
        stock: mockProduct.stock.toString(),
        sizes: mockProduct.sizes,
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Update product:', params.id, formData);
        setIsSaving(false);
        router.push('/admin/products');
    };

    const handleDelete = async () => {
        if (confirm('Bạn có chắc muốn xóa sản phẩm này?')) {
            console.log('Delete product:', params.id);
            router.push('/admin/products');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/products"
                        className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Chỉnh sửa sản phẩm</h1>
                        <p className="text-white/50 mt-1">ID: {params.id}</p>
                    </div>
                </div>
                <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-red-400 hover:bg-red-500/20 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Xóa sản phẩm
                </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="lg:col-span-2 bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-5"
                >
                    <h2 className="text-lg font-semibold text-white">Thông tin sản phẩm</h2>

                    <div>
                        <label className="text-white/70 text-sm mb-2 block">Tên sản phẩm *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="VD: Dragon Figure"
                            className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-white/70 text-sm mb-2 block">Danh mục</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                            >
                                {categories.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-white/70 text-sm mb-2 block">Tồn kho</label>
                            <input
                                type="number"
                                value={formData.stock}
                                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                placeholder="0"
                                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-white/70 text-sm mb-2 block">Mô tả</label>
                        <textarea
                            rows={4}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Mô tả chi tiết sản phẩm..."
                            className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
                        />
                    </div>

                    {/* Sizes */}
                    <div>
                        <label className="text-white/70 text-sm mb-2 block">Kích thước & Giá</label>
                        <div className="space-y-3">
                            {formData.sizes.map((size, index) => (
                                <div key={size.name} className="flex items-center gap-3">
                                    <span className="w-12 text-center text-white font-medium">{size.name}</span>
                                    <input
                                        type="number"
                                        value={size.price}
                                        onChange={(e) => {
                                            const newSizes = [...formData.sizes];
                                            newSizes[index].price = e.target.value;
                                            setFormData({ ...formData, sizes: newSizes });
                                        }}
                                        placeholder="Giá (VNĐ)"
                                        className="flex-1 px-4 py-2.5 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Sidebar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-6"
                >
                    {/* Image */}
                    <div className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Hình ảnh</h2>
                        <div className="aspect-square rounded-xl bg-white/10 flex items-center justify-center mb-4">
                            <span className="text-6xl">🐉</span>
                        </div>
                        <button type="button" className="w-full py-2.5 rounded-xl border border-white/20 text-white/70 hover:text-white transition-colors">
                            Thay đổi ảnh
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-3">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
                        >
                            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/admin/products')}
                            className="w-full py-3 rounded-xl border border-white/20 text-white/70 hover:text-white transition-colors"
                        >
                            Hủy
                        </button>
                    </div>

                    {/* Meta info */}
                    <div className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6">
                        <h3 className="text-white/70 text-sm mb-3">Thông tin</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-white/50">Tạo lúc</span>
                                <span className="text-white">10/01/2026</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/50">Cập nhật</span>
                                <span className="text-white">15/01/2026</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/50">Đã bán</span>
                                <span className="text-white">24 sản phẩm</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </form>
        </div>
    );
}
