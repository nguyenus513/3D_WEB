'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { generateId } from '@/lib/generateId';

const categories = ['Figure', 'Bust', 'Trophy', 'Custom', 'Accessory'];
const availableTags = ['Hot', 'New', 'Sale', 'Limited', 'Exclusive', 'Best Seller'];

interface SizeVariant {
    name: string;
    price: string;
    stock: string;
    enabled: boolean;
}

// Mock product data
const mockProduct = {
    name: 'Dragon Figure',
    sku: 'DRAGON-001',
    category: 'Figure',
    status: 'active',
    basePrice: '350000',
    salePrice: '',
    shortDescription: 'Mô hình rồng chi tiết cao',
    description: 'Mô hình rồng chi tiết cao, được thiết kế và in 3D chất lượng cao. Chất liệu nhựa PLA cao cấp, độ bền tốt.',
    images: ['🐉'],
    videoUrl: '',
    sizes: [
        { name: 'S', price: '250000', stock: '10', enabled: true },
        { name: 'M', price: '350000', stock: '15', enabled: true },
        { name: 'L', price: '450000', stock: '8', enabled: true },
        { name: 'XL', price: '550000', stock: '3', enabled: true },
    ] as SizeVariant[],
    totalStock: '36',
    lowStockAlert: '5',
    metaTitle: 'Dragon Figure - Mô hình rồng 3D',
    metaDescription: 'Mua mô hình rồng Dragon Figure chất lượng cao tại 3D Print VN',
    tags: ['Hot', 'Best Seller'],
    isFeatured: true,
};

export default function AdminProductEditPage() {
    const router = useRouter();
    const params = useParams();
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        ...mockProduct
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
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

    const toggleTag = (tag: string) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.includes(tag)
                ? prev.tags.filter(t => t !== tag)
                : [...prev.tags, tag]
        }));
    };

    const toggleSize = (index: number) => {
        const newSizes = [...formData.sizes];
        newSizes[index].enabled = !newSizes[index].enabled;
        setFormData({ ...formData, sizes: newSizes });
    };

    const updateSize = (index: number, field: 'price' | 'stock', value: string) => {
        const newSizes = [...formData.sizes];
        newSizes[index][field] = value;
        setFormData({ ...formData, sizes: newSizes });
    };

    const addSize = () => {
        const newName = prompt('Nhập tên size mới (VD: XXL):');
        if (newName) {
            setFormData({
                ...formData,
                sizes: [...formData.sizes, { name: newName, price: '', stock: '', enabled: true }]
            });
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
                        <p className="text-white/50 mt-1">ID: {params.id} • SKU: {formData.sku}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="px-4 py-2 bg-[#1D1D1F] border border-white/10 rounded-xl text-white"
                    >
                        <option value="draft">Nháp</option>
                        <option value="active">Đang bán</option>
                        <option value="archived">Lưu trữ</option>
                    </select>
                    <button
                        onClick={handleDelete}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Xóa
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic info */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-5"
                    >
                        <h2 className="text-lg font-semibold text-white">Thông tin cơ bản</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
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
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">SKU (Mã sản phẩm)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.sku}
                                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                        placeholder="VD: SKU-A7K3M9B2"
                                        className="flex-1 px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, sku: generateId.sku() })}
                                        className="px-4 py-3 bg-white/10 rounded-xl text-white/70 hover:text-white hover:bg-white/20 transition-colors text-sm whitespace-nowrap"
                                    >
                                        Tạo mã
                                    </button>
                                </div>
                            </div>
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
                        </div>

                        <div>
                            <label className="text-white/70 text-sm mb-2 block">Mô tả ngắn</label>
                            <input
                                type="text"
                                value={formData.shortDescription}
                                onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                                placeholder="Mô tả ngắn gọn sản phẩm..."
                                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                            />
                        </div>

                        <div>
                            <label className="text-white/70 text-sm mb-2 block">Mô tả chi tiết</label>
                            <textarea
                                rows={6}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Mô tả đầy đủ về sản phẩm, chất liệu, kích thước, cách sử dụng..."
                                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
                            />
                        </div>
                    </motion.div>

                    {/* Media */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-5"
                    >
                        <h2 className="text-lg font-semibold text-white">Hình ảnh & Video</h2>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Main image with existing */}
                            <div className="aspect-square rounded-xl border-2 border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-white/40 transition-colors relative col-span-2 row-span-2 bg-white/5">
                                <span className="text-6xl">{formData.images[0]}</span>
                                <span className="absolute bottom-2 left-2 text-xs bg-white text-black px-2 py-0.5 rounded">Chính</span>
                                <span className="absolute top-2 right-2 text-xs bg-white/20 text-white px-2 py-0.5 rounded cursor-pointer hover:bg-white/30">Thay đổi</span>
                            </div>
                            {/* Gallery */}
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="aspect-square rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:border-white/30 transition-colors">
                                    <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                            ))}
                        </div>

                        <div>
                            <label className="text-white/70 text-sm mb-2 block">Video URL (YouTube/Vimeo)</label>
                            <input
                                type="url"
                                value={formData.videoUrl}
                                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                                placeholder="https://youtube.com/watch?v=..."
                                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                            />
                        </div>
                    </motion.div>

                    {/* Variants */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-5"
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Kích thước & Giá</h2>
                            <button type="button" onClick={addSize} className="text-sm text-white/50 hover:text-white transition-colors">
                                + Thêm size
                            </button>
                        </div>

                        <div className="space-y-3">
                            {formData.sizes.map((size, index) => (
                                <div key={size.name} className={`flex items-center gap-3 p-3 rounded-xl ${size.enabled ? 'bg-white/5' : 'bg-white/5 opacity-50'}`}>
                                    <button
                                        type="button"
                                        onClick={() => toggleSize(index)}
                                        className={`w-5 h-5 rounded border ${size.enabled ? 'bg-white border-white' : 'border-white/30'} flex items-center justify-center`}
                                    >
                                        {size.enabled && <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                    </button>
                                    <span className="w-12 text-center text-white font-medium">{size.name}</span>
                                    <input
                                        type="number"
                                        value={size.price}
                                        onChange={(e) => updateSize(index, 'price', e.target.value)}
                                        placeholder="Giá (VNĐ)"
                                        disabled={!size.enabled}
                                        className="flex-1 px-4 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50"
                                    />
                                    <input
                                        type="number"
                                        value={size.stock}
                                        onChange={(e) => updateSize(index, 'stock', e.target.value)}
                                        placeholder="Tồn kho"
                                        disabled={!size.enabled}
                                        className="w-24 px-4 py-2 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Giá gốc (không size)</label>
                                <input
                                    type="number"
                                    value={formData.basePrice}
                                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                                    placeholder="350000"
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                                />
                            </div>
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Giá sale</label>
                                <input
                                    type="number"
                                    value={formData.salePrice}
                                    onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                                    placeholder="299000"
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                                />
                            </div>
                        </div>
                    </motion.div>

                    {/* SEO */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-5"
                    >
                        <h2 className="text-lg font-semibold text-white">SEO (Tùy chọn)</h2>

                        <div>
                            <label className="text-white/70 text-sm mb-2 block">Meta Title</label>
                            <input
                                type="text"
                                value={formData.metaTitle}
                                onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                                placeholder="Tiêu đề hiển thị trên Google"
                                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                            />
                        </div>

                        <div>
                            <label className="text-white/70 text-sm mb-2 block">Meta Description</label>
                            <textarea
                                rows={3}
                                value={formData.metaDescription}
                                onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                                placeholder="Mô tả ngắn hiển thị trên kết quả tìm kiếm..."
                                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
                            />
                        </div>
                    </motion.div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Product info */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
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
                            <div className="flex justify-between">
                                <span className="text-white/50">Lượt xem</span>
                                <span className="text-white">156</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Tags */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-4">Tags</h2>
                        <div className="flex flex-wrap gap-2">
                            {availableTags.map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => toggleTag(tag)}
                                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${formData.tags.includes(tag)
                                        ? 'bg-white text-black'
                                        : 'bg-white/10 text-white/70 hover:text-white'
                                        }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isFeatured}
                                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                                    className="w-5 h-5 rounded border-white/20 bg-[#0a0a0a]"
                                />
                                <span className="text-white">Sản phẩm nổi bật</span>
                            </label>
                        </div>
                    </motion.div>

                    {/* Stock alert */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-4">Tồn kho</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Tồn kho tổng</label>
                                <input
                                    type="number"
                                    value={formData.totalStock}
                                    onChange={(e) => setFormData({ ...formData, totalStock: e.target.value })}
                                    placeholder="0"
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                                />
                            </div>
                            <div>
                                <label className="text-white/70 text-sm mb-2 block">Cảnh báo hết hàng khi</label>
                                <input
                                    type="number"
                                    value={formData.lowStockAlert}
                                    onChange={(e) => setFormData({ ...formData, lowStockAlert: e.target.value })}
                                    placeholder="5"
                                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                                />
                            </div>
                        </div>
                    </motion.div>

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="bg-[#1D1D1F] rounded-2xl border border-white/10 p-6 space-y-3"
                    >
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
                    </motion.div>
                </div>
            </form>
        </div>
    );
}
