'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSupabase } from '@/lib/supabase/client';
import type { Product } from '@/types/database';
import { useAdminPath } from '@/hooks/useAdminPath';

interface FeaturedProduct extends Product {
    images: { url: string; alt?: string }[];
}

export default function AdminFeaturedPage() {
    const { adminRoot } = useAdminPath();
    const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
    const [allProducts, setAllProducts] = useState<FeaturedProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        fetchFeaturedProducts();
        fetchAllProducts();
    }, []);

    const fetchFeaturedProducts = async () => {
        setLoading(true);
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_featured', true)
            .eq('status', 'active')
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching featured products:', error);
        } else {
            setFeaturedProducts(data || []);
        }
        setLoading(false);
    };

    const fetchAllProducts = async () => {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('status', 'active')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching all products:', error);
        } else {
            setAllProducts(data || []);
        }
    };

    const addToFeatured = async (productId: string) => {
        setUpdating(productId);
        try {
            const response = await fetch('/api/admin/products', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: productId, is_featured: true }),
            });

            if (response.ok) {
                await fetchFeaturedProducts();
                setShowModal(false);
            }
        } catch (error) {
            console.error('Error adding to featured:', error);
        }
        setUpdating(null);
    };

    const removeFromFeatured = async (productId: string) => {
        if (!confirm('Bạn có chắc muốn bỏ sản phẩm này khỏi danh sách nổi bật?')) return;

        setUpdating(productId);
        try {
            const response = await fetch('/api/admin/products', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: productId, is_featured: false }),
            });

            if (response.ok) {
                await fetchFeaturedProducts();
            }
        } catch (error) {
            console.error('Error removing from featured:', error);
        }
        setUpdating(null);
    };

    const getProductImage = (product: FeaturedProduct) => {
        if (product.images && product.images.length > 0) {
            return product.images[0].url;
        }
        return null;
    };

    // Filter products not already featured
    const availableProducts = allProducts.filter(
        p => !featuredProducts.some(fp => fp.id === p.id) &&
            p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 md:p-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white">Sản Phẩm Nổi Bật</h1>
                    <p className="text-white/50 mt-1">Quản lý sản phẩm hiển thị trên trang chủ</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Thêm sản phẩm
                </button>
            </div>

            {/* Featured Products List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
            ) : featuredProducts.length === 0 ? (
                <div className="text-center py-20 bg-[#1D1D1F] rounded-2xl">
                    <svg className="w-16 h-16 text-white/20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <p className="text-white/50">Chưa có sản phẩm nổi bật nào</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="mt-4 px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                    >
                        Thêm sản phẩm đầu tiên
                    </button>
                </div>
            ) : (
                <div className="bg-[#1D1D1F] rounded-2xl overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left px-6 py-4 text-white/50 font-medium text-sm">Sản phẩm</th>
                                <th className="text-left px-6 py-4 text-white/50 font-medium text-sm">Giá</th>
                                <th className="text-left px-6 py-4 text-white/50 font-medium text-sm">Tồn kho</th>
                                <th className="text-right px-6 py-4 text-white/50 font-medium text-sm">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {featuredProducts.map((product) => (
                                <motion.tr
                                    key={product.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-[#2D2D2F] rounded-lg overflow-hidden flex-shrink-0">
                                                {getProductImage(product) ? (
                                                    <img
                                                        src={getProductImage(product)!}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-white/30">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{product.name}</p>
                                                <p className="text-white/40 text-sm">{product.sku}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-white">
                                            {(product.sale_price || product.base_price).toLocaleString('vi-VN')}đ
                                        </span>
                                        {product.sale_price && (
                                            <span className="text-white/40 line-through ml-2 text-sm">
                                                {product.base_price.toLocaleString('vi-VN')}đ
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`${product.stock > 10 ? 'text-green-400' : product.stock > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {product.stock}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => removeFromFeatured(product.id)}
                                            disabled={updating === product.id}
                                            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                                        >
                                            {updating === product.id ? (
                                                <span className="flex items-center gap-2">
                                                    <span className="w-4 h-4 border-2 border-red-400/20 border-t-red-400 rounded-full animate-spin" />
                                                    Đang xóa...
                                                </span>
                                            ) : (
                                                'Xóa khỏi nổi bật'
                                            )}
                                        </button>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Product Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#1D1D1F] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-white/10">
                                <h2 className="text-xl font-bold text-white">Chọn sản phẩm</h2>
                                <p className="text-white/50 text-sm mt-1">Chọn sản phẩm để thêm vào danh sách nổi bật</p>
                            </div>

                            <div className="p-4 border-b border-white/10">
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm sản phẩm..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-3 bg-[#2D2D2F] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                                />
                            </div>

                            <div className="overflow-y-auto max-h-[400px]">
                                {availableProducts.length === 0 ? (
                                    <div className="text-center py-12 text-white/50">
                                        {searchTerm ? 'Không tìm thấy sản phẩm' : 'Tất cả sản phẩm đã được thêm vào nổi bật'}
                                    </div>
                                ) : (
                                    <div className="divide-y divide-white/5">
                                        {availableProducts.map((product) => (
                                            <div
                                                key={product.id}
                                                className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-[#2D2D2F] rounded-lg overflow-hidden flex-shrink-0">
                                                        {getProductImage(product) ? (
                                                            <img
                                                                src={getProductImage(product)!}
                                                                alt={product.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-white/30">
                                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-medium">{product.name}</p>
                                                        <p className="text-white/40 text-sm">
                                                            {(product.sale_price || product.base_price).toLocaleString('vi-VN')}đ
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => addToFeatured(product.id)}
                                                    disabled={updating === product.id}
                                                    className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
                                                >
                                                    {updating === product.id ? (
                                                        <span className="flex items-center gap-2">
                                                            <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                                        </span>
                                                    ) : (
                                                        'Thêm'
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-white/10 flex justify-end">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                                >
                                    Đóng
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
