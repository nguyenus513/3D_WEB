'use client';

import { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase/client';
import type { Product } from '@/types/database';
import { useAdminPath } from '@/hooks/useAdminPath';

interface ProductWithStats extends Product {
    sold_count: number;
    buyer_count: number;
}

export default function AdminProductsPage() {
    const { adminRoot } = useAdminPath();
    const [products, setProducts] = useState<ProductWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [deleting, setDeleting] = useState<string | null>(null);
    const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);

    useEffect(() => {
        fetchCategories();
        fetchProducts();
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/admin/categories');
            const data = await response.json();
            setCategories(data.categories || []);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchProducts = async () => {
        setLoading(true);
        const supabase = getSupabase();

        // Fetch products with category info
        const { data: productsData, error } = await supabase
            .from('products')
            .select('*, category:categories(*)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching products:', error);
            setLoading(false);
            return;
        }

        // Note: order_items stats removed due to RLS restrictions
        // TODO: Create admin API endpoint for product stats if needed
        const productsWithStats = (productsData || []).map((product: any) => ({
            ...product,
            sizes: product.sizes || [], // Use the JSON column directly
            status: (product as any).status || ((product as any).is_active ? 'active' : 'draft'),
            sold_count: 0,
            buyer_count: 0,
        }));

        setProducts(productsWithStats);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;

        setDeleting(id);
        const supabase = getSupabase();

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Không thể xóa sản phẩm: ' + error.message);
        } else {
            setProducts(products.filter(p => p.id !== id));
        }
        setDeleting(null);
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            active: 'bg-green-500/20 text-green-400',
            draft: 'bg-yellow-500/20 text-yellow-400',
            archived: 'bg-white/10 text-white/50',
        };
        const labels: Record<string, string> = {
            active: 'Đang bán',
            draft: 'Nháp',
            archived: 'Lưu trữ',
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
                {labels[status] || status}
            </span>
        );
    };

    const getDisplayPrice = (product: ProductWithStats) => {
        if (product.sizes && product.sizes.length > 0) {
            const prices = product.sizes.map(s => s.price);
            const min = Math.min(...prices);
            const max = Math.max(...prices);

            if (min === max) {
                return <span className="text-white">{Number(min).toLocaleString('vi-VN')}đ</span>;
            }
            return <span className="text-white">{Number(min).toLocaleString('vi-VN')}đ - {Number(max).toLocaleString('vi-VN')}đ</span>;
        }

        return (
            <>
                <span className="text-white">
                    {Number(product.base_price).toLocaleString('vi-VN')}đ
                </span>
                {product.sale_price && (
                    <span className="text-green-400 text-sm ml-2">
                        Sale: {Number(product.sale_price).toLocaleString('vi-VN')}đ
                    </span>
                )}
            </>
        );
    };

    const getDisplayStock = (product: ProductWithStats) => {
        let totalStock = product.stock;

        if (product.sizes && product.sizes.length > 0) {
            totalStock = product.sizes.reduce((sum, size) => sum + size.stock, 0);
        }

        return (
            <span className={`font-medium ${totalStock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalStock > 0 ? totalStock : 'Hết hàng'}
            </span>
        );
    };

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (product.sku || '').toLowerCase().includes(searchTerm.toLowerCase());

        let matchesCategory = true;
        if (activeTab === 'other') {
            matchesCategory = !product.category;
        } else if (activeTab !== 'all') {
            matchesCategory = product.category?.id === activeTab;
        }

        return matchesSearch && matchesCategory;
    });

    // Check if there are products with no category
    const hasOtherProducts = products.some(p => !p.category);

    return (
        <div className="space-y-6">
            {/* Header */}
            {/* ... header code ... */}

            {/* Filters */}
            <div className="space-y-4">
                {/* Search */}
                <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Tìm theo tên, SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[#1D1D1F] border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                </div>

                {/* Horizontal Tabs */}
                <div className="flex items-center gap-6 border-b border-white/10 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'all' ? 'text-white' : 'text-white/50 hover:text-white'
                            }`}
                    >
                        Tất cả
                        {activeTab === 'all' && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
                            />
                        )}
                    </button>

                    {categories.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => setActiveTab(category.id)}
                            className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === category.id ? 'text-white' : 'text-white/50 hover:text-white'
                                }`}
                        >
                            {category.name}
                            {activeTab === category.id && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
                                />
                            )}
                        </button>
                    ))}

                    {hasOtherProducts && (
                        <button
                            onClick={() => setActiveTab('other')}
                            className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'other' ? 'text-white' : 'text-white/50 hover:text-white'
                                }`}
                        >
                            Khác
                            {activeTab === 'other' && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
                                />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Products table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1D1D1F] rounded-2xl border border-white/10 overflow-hidden"
            >
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="inline-block w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
                        <p className="text-white/50">Đang tải sản phẩm...</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-white/50 mb-4">
                            {products.length === 0 ? 'Chưa có sản phẩm nào' : 'Không tìm thấy sản phẩm'}
                        </p>
                        {products.length === 0 && (
                            <Link
                                href={`${adminRoot}/products/new`}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl font-medium"
                            >
                                Thêm sản phẩm đầu tiên
                            </Link>
                        )}
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Sản phẩm</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">SKU</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Giá</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Tồn kho</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Đã bán</th>
                                <th className="text-left text-white/50 text-sm font-medium px-5 py-4">Trạng thái</th>
                                <th className="text-right text-white/50 text-sm font-medium px-5 py-4">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Grouping Logic */}
                            {(() => {
                                // 1. Group products by category ID (or 'other')
                                const groups: Record<string, ProductWithStats[]> = {};
                                const otherProducts: ProductWithStats[] = [];

                                filteredProducts.forEach(product => {
                                    if (product.category?.name) {
                                        const catName = product.category.name;
                                        if (!groups[catName]) groups[catName] = [];
                                        groups[catName].push(product);
                                    } else {
                                        otherProducts.push(product);
                                    }
                                });

                                // 2. Determine display order based on 'categories' state
                                const orderedGroups = categories
                                    .map(c => c.name)
                                    .filter(name => groups[name] && groups[name].length > 0)
                                    .map(name => ({ name, products: groups[name] }));

                                // 3. Add 'Khác' group if exists
                                if (otherProducts.length > 0) {
                                    orderedGroups.push({ name: 'Khác', products: otherProducts });
                                }

                                // 4. Render groups
                                return orderedGroups.map(group => (
                                    <Fragment key={group.name}>
                                        {/* Group Header - Only show if viewing all */}
                                        {activeTab === 'all' && (
                                            <tr key={`group-${group.name}`} className="bg-white/5 border-b border-white/10">
                                                <td colSpan={7} className="px-5 py-3 text-sm font-bold text-white/80 uppercase tracking-wider">
                                                    {group.name} ({group.products.length})
                                                </td>
                                            </tr>
                                        )}

                                        {/* Products in Group */}
                                        {group.products.map((product) => (
                                            <tr key={product.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
                                                            {(() => {
                                                                const mainImg = product.images?.[0];
                                                                const imgUrl = typeof mainImg === 'string' ? mainImg : (mainImg as any)?.url;
                                                                return imgUrl ? (
                                                                    <img
                                                                        src={imgUrl}
                                                                        alt={product.name}
                                                                        className="w-full h-full object-cover"
                                                                        onError={(e) => {
                                                                            (e.target as HTMLImageElement).src = '/placeholder.svg';
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <span className="text-2xl">📦</span>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div>
                                                            <span className="text-white font-medium block">{product.name}</span>
                                                            {product.is_featured && (
                                                                <span className="text-xs text-yellow-400">⭐ Nổi bật</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <code className="text-white/60 text-sm bg-white/5 px-2 py-1 rounded">
                                                        {product.sku}
                                                    </code>
                                                </td>
                                                <td className="px-5 py-4">
                                                    {getDisplayPrice(product)}
                                                </td>
                                                <td className="px-5 py-4">
                                                    {getDisplayStock(product)}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-medium">{product.sold_count}</span>
                                                        <span className="text-white/50 text-sm">({product.buyer_count} KH)</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    {getStatusBadge(product.status)}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link
                                                            href={`${adminRoot}/products/${product.id}`}
                                                            className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </Link>
                                                        <button
                                                            onClick={() => handleDelete(product.id)}
                                                            disabled={deleting === product.id}
                                                            className="p-2 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors disabled:opacity-50"
                                                        >
                                                            {deleting === product.id ? (
                                                                <div className="w-5 h-5 border-2 border-red-400/20 border-t-red-400 rounded-full animate-spin" />
                                                            ) : (
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </Fragment>
                                ));
                            })()}
                        </tbody>
                    </table>
                )}

                {/* Stats */}
                {!loading && products.length > 0 && (
                    <div className="p-4 border-t border-white/10 flex items-center justify-between">
                        <span className="text-white/50 text-sm">
                            Hiển thị {filteredProducts.length} / {products.length} sản phẩm
                        </span>
                        <button
                            onClick={fetchProducts}
                            className="text-sm text-white/50 hover:text-white transition-colors"
                        >
                            ↻ Làm mới
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
