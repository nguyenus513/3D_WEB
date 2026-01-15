'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Mock products data
const products = [
    { id: 1, name: 'Dragon Figure', category: 'Figure', price: 350000, stock: 15, image: '🐉' },
    { id: 2, name: 'Superhero Bust', category: 'Bust', price: 450000, stock: 8, image: '🦸' },
    { id: 3, name: 'Anime Character', category: 'Figure', price: 280000, stock: 22, image: '🦊' },
    { id: 4, name: 'Gaming Trophy', category: 'Trophy', price: 320000, stock: 12, image: '🎮' },
    { id: 5, name: 'Custom Couple', category: 'Custom', price: 650000, stock: 0, image: '💑' },
    { id: 6, name: 'Pet Portrait', category: 'Custom', price: 400000, stock: 5, image: '🐕' },
];

const categories = ['Tất cả', 'Figure', 'Bust', 'Trophy', 'Custom'];

export default function AdminProductsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Tất cả');

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'Tất cả' || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Sản phẩm</h1>
                    <p className="text-white/50 mt-1">Quản lý sản phẩm của shop</p>
                </div>
                <Link
                    href="/admin/products/new"
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Thêm sản phẩm
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Tìm sản phẩm..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[#1D1D1F] border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                </div>

                {/* Category filter */}
                <div className="flex gap-2">
                    {categories.map((category) => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${selectedCategory === category
                                    ? 'bg-white text-black'
                                    : 'bg-[#1D1D1F] text-white/70 hover:text-white border border-white/10'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* Products table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 overflow-hidden"
            >
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Sản phẩm</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Danh mục</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Giá</th>
                            <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Tồn kho</th>
                            <th className="text-right text-white/50 text-sm font-medium px-5 py-4">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProducts.map((product) => (
                            <tr key={product.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                                            {product.image}
                                        </div>
                                        <span className="text-white font-medium">{product.name}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <span className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-sm">
                                        {product.category}
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-white">
                                    {product.price.toLocaleString('vi-VN')}đ
                                </td>
                                <td className="px-5 py-4">
                                    <span className={`font-medium ${product.stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {product.stock > 0 ? product.stock : 'Hết hàng'}
                                    </span>
                                </td>
                                <td className="px-5 py-4">
                                    <div className="flex items-center justify-end gap-2">
                                        <Link
                                            href={`/admin/products/${product.id}`}
                                            className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </Link>
                                        <button className="p-2 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Pagination */}
                <div className="p-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-white/50 text-sm">
                        Hiển thị {filteredProducts.length} / {products.length} sản phẩm
                    </span>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:text-white transition-colors">
                            ←
                        </button>
                        <button className="px-3 py-1.5 rounded-lg bg-white text-black font-medium">
                            1
                        </button>
                        <button className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:text-white transition-colors">
                            2
                        </button>
                        <button className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:text-white transition-colors">
                            →
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
