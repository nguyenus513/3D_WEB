'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

const categories = ['Figure', 'Bust', 'Trophy', 'Custom', 'Accessory'];

export default function AdminProductNewPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '',
        category: 'Figure',
        price: '',
        description: '',
        stock: '',
        sizes: [{ name: 'S', price: '' }, { name: 'M', price: '' }, { name: 'L', price: '' }],
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Handle save
        console.log('Save product:', formData);
        router.push('/admin/products');
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
                        <h1 className="text-2xl font-bold text-white">Thêm sản phẩm</h1>
                        <p className="text-white/50 mt-1">Tạo sản phẩm mới</p>
                    </div>
                </div>
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
                    {/* Image upload */}
                    <div className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Hình ảnh</h2>
                        <div className="aspect-square rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-white/40 transition-colors">
                            <svg className="w-12 h-12 text-white/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-white/50 text-sm">Click để upload ảnh</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-3">
                        <button
                            type="submit"
                            className="w-full py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors"
                        >
                            Lưu sản phẩm
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/admin/products')}
                            className="w-full py-3 rounded-xl border border-white/20 text-white/70 hover:text-white transition-colors"
                        >
                            Hủy
                        </button>
                    </div>
                </motion.div>
            </form>
        </div>
    );
}
