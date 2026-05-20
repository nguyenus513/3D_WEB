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
    status: string;
}

export default function AdminProductsPage() {
    const { adminRoot } = useAdminPath();
    const [products, setProducts] = useState<ProductWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [deleting, setDeleting] = useState<string | null>(null);
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

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

        try {
            // Use API endpoint with admin auth instead of direct Supabase
            const response = await fetch('/api/admin/products');
            const responseJson = await response.json();

            // API uses envelope pattern: { success: true, data: { products: [...] } }
            const data = responseJson.data || responseJson; // Support both formats

            console.log('[AdminProducts] API Response:', {
                ok: response.ok,
                status: response.status,
                hasEnvelope: !!responseJson.data,
                productsCount: data.products?.length,
            });

            if (!response.ok) {
                console.error('Error fetching products:', responseJson.error);
                setLoading(false);
                return;
            }

            // Map products to include stats
            const productsWithStats = (data.products || []).map((product: any) => ({
                ...product,
                // Map product_variants from JOIN to variants (mapToProduct may have already renamed it)
                variants: product.variants || product.product_variants || [],
                status: product.status || (product.is_active ? 'active' : 'draft'),
                sold_count: product.sold_count || 0,
                buyer_count: 0,
            }));

            console.log('[AdminProducts] Fetched products:', productsWithStats.length, productsWithStats.map((p: any) => ({ name: p.name, category: p.category })));
            setProducts(productsWithStats);
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;

        setDeleting(id);
        try {
            const response = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) {
                alert('Không thể xóa sản phẩm: ' + (result?.error?.message || result?.error || `HTTP ${response.status}`));
                return;
            }
            setProducts(products.filter((product) => product.id !== id));
        } catch (error) {
            alert('Không thể xóa sản phẩm: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setDeleting(null);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            active: 'bg-green-500/20 text-green-400',
            draft: 'bg-[var(--material-glass)] text-[var(--text-secondary)]',
        };
        const labels: Record<string, string> = {
            active: 'Đang bán',
            draft: 'Ẩn',
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
                {labels[status] || 'Ẩn'}
            </span>
        );
    };

    const getDisplayPrice = (product: ProductWithStats) => {
        const variants = (product as any).variants || [];
        if (variants.length > 0) {
            const prices = variants.map((v: any) => Number(v.price));
            const min = Math.min(...prices);
            const max = Math.max(...prices);

            if (min === max) {
                return <span className="text-[var(--text-primary)]">{min.toLocaleString('vi-VN')}đ</span>;
            }
            return <span className="text-[var(--text-primary)]">{min.toLocaleString('vi-VN')}đ - {max.toLocaleString('vi-VN')}đ</span>;
        }

        return (
            <>
                <span className="text-[var(--text-primary)]">
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
        const variants = (product as any).variants || [];
        // Sum stock across all variants, or use product.stock if no variants
        const totalStock = variants.length > 0
            ? variants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0)
            : product.stock;

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
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Sản phẩm</h1>
                <Link
                    href={`${adminRoot}/products/new`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl font-medium hover:bg-[var(--material-glass)] transition-colors"
                >
                    + Thêm sản phẩm
                </Link>
            </div>

            {/* Filters */}
            <div className="space-y-4">
                {/* Search */}
                <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Tìm theo tên, SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[var(--material-panel)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                </div>

                {/* Horizontal Tabs */}
                <div className="flex items-center gap-6 border-b border-[var(--border-color)] overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'all' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                            className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === category.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                            className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'other' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                className="bg-[var(--material-panel)] rounded-2xl border border-[var(--border-color)] overflow-hidden"
            >
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="inline-block w-8 h-8 border-2 border-[var(--border-color)] border-t-white rounded-full animate-spin mb-4" />
                        <p className="text-[var(--text-secondary)]">Đang tải sản phẩm...</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-[var(--text-secondary)] mb-4">
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
                            <tr className="border-b border-[var(--border-color)]">
                                <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Sản phẩm</th>
                                <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">SKU</th>
                                <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Giá</th>
                                <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Tồn kho</th>
                                <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Đã bán</th>
                                <th className="text-left text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Trạng thái</th>
                                <th className="text-right text-[var(--text-secondary)] text-sm font-medium px-5 py-4">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Grouping Logic */}
                            {(() => {
                                // 1. Group products by category name (or 'other')
                                const groups: Record<string, ProductWithStats[]> = {};
                                const otherProducts: ProductWithStats[] = [];

                                // Build a set of known category names for fast lookup
                                const knownCategoryNames = new Set(categories.map(c => c.name.trim()));

                                filteredProducts.forEach(product => {
                                    const catName = product.category?.name?.trim();
                                    if (catName && knownCategoryNames.has(catName)) {
                                        // Product has category that matches our categories list
                                        if (!groups[catName]) groups[catName] = [];
                                        groups[catName].push(product);
                                    } else {
                                        // No category OR category not in our list
                                        otherProducts.push(product);
                                    }
                                });

                                // 2. Determine display order based on 'categories' state
                                const orderedGroups = categories
                                    .map(c => c.name.trim())
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
                                            <tr key={`group-${group.name}`} className="bg-white/5 border-b border-[var(--border-color)]">
                                                <td colSpan={7} className="px-5 py-3 text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                                    {group.name} ({group.products.length})
                                                </td>
                                            </tr>
                                        )}

                                        {/* Products in Group */}
                                        {group.products.map((product) => (
                                            <tr key={product.id} className="border-b border-[var(--border-color)] hover:bg-[var(--material-glass)] transition-colors">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-xl bg-[var(--material-glass)] flex items-center justify-center overflow-hidden">
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
                                                            <span className="text-[var(--text-primary)] font-medium block">{product.name}</span>
                                                            {product.is_featured && (
                                                                <span className="text-xs text-yellow-400">⭐ Nổi bật</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <code className="text-[var(--text-secondary)] text-sm bg-[var(--material-glass)] px-2 py-1 rounded">
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
                                                        <span className="text-[var(--text-primary)] font-medium">{product.sold_count}</span>
                                                        <span className="text-[var(--text-secondary)] text-sm">({product.buyer_count} KH)</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    {getStatusBadge(product.status)}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link
                                                            href={`${adminRoot}/products/${product.id}`}
                                                            className="p-2 rounded-lg hover:bg-[var(--material-glass)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </Link>
                                                        <button
                                                            onClick={() => handleDelete(product.id)}
                                                            disabled={deleting === product.id}
                                                            className="p-2 rounded-lg hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-400 transition-colors disabled:opacity-50"
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
                    <div className="p-4 border-t border-[var(--border-color)] flex items-center justify-between">
                        <span className="text-[var(--text-secondary)] text-sm">
                            Hiển thị {filteredProducts.length} / {products.length} sản phẩm
                        </span>
                        <button
                            onClick={fetchProducts}
                            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            ↻ Làm mới
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
