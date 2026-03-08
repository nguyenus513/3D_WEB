'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product } from '@/types/database';
import { Search, X, Box, Star } from 'lucide-react';

interface Category {
    id: string;
    name: string;
}

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'bestseller';

function ProductGridSkeletonUI({ count = 8 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-3xl overflow-hidden border border-[var(--border-color)] bg-[var(--material-panel)]">
                    <Skeleton className="aspect-square w-full" />
                    <div className="p-5 space-y-3">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/3" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeCategory, setActiveCategory] = useState('Tất cả');
    const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('newest');
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000000]);

    useEffect(() => {
        fetchCategories();
        fetchProducts();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/public/categories');
            const json = await res.json();
            setCategories(json.data || []);
        } catch {
            setCategories([]);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/public/products');
            const json = await res.json();
            setProducts(json.data || []);
        } catch {
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    const getDisplayPrice = (product: Product) => {
        const sizes = product.sizes as any[];
        if (sizes && sizes.length > 0) {
            const prices = sizes.filter(s => s.enabled !== false).map(s => s.price);
            if (prices.length > 0) {
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                if (min === max) {
                    return `${min.toLocaleString('vi-VN')}đ`;
                }
                return `${min.toLocaleString('vi-VN')} - ${max.toLocaleString('vi-VN')}đ`;
            }
        }
        const price = product.sale_price || product.base_price;
        return `${Number(price).toLocaleString('vi-VN')}đ`;
    };

    const filteredProducts = products
        .filter(p => {
            const matchesCategory = activeCategory === 'Tất cả'
                || p.category_id === categories.find(c => c.name === activeCategory)?.id;

            const searchLower = searchQuery.toLowerCase().trim();
            const matchesSearch = !searchLower ||
                p.name.toLowerCase().includes(searchLower) ||
                p.sku?.toLowerCase().includes(searchLower) ||
                p.short_description?.toLowerCase().includes(searchLower);

            const price = Number(p.sale_price || p.base_price);
            const matchesPrice = price >= priceRange[0] && price <= priceRange[1];

            return matchesCategory && matchesSearch && matchesPrice;
        })
        .sort((a, b) => {
            const priceA = Number(a.sale_price || a.base_price);
            const priceB = Number(b.sale_price || b.base_price);

            switch (sortBy) {
                case 'price_asc':
                    return priceA - priceB;
                case 'price_desc':
                    return priceB - priceA;
                case 'bestseller':
                    return (b.sold_count || 0) - (a.sold_count || 0);
                case 'newest':
                default:
                    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
            }
        });

    const getColors = (index: number) => {
        const colorPairs = [
            ['#FF6B6B', '#4ECDC4'],
            ['#0071E3', '#FF9500'],
            ['#FF6B6B', '#A855F7'],
            ['#30D158', '#0071E3'],
            ['#FFD60A', '#FF9500'],
        ];
        return colorPairs[index % colorPairs.length];
    };

    return (
        <div className="min-h-screen bg-[var(--bg-void)] pt-32 pb-20">
            <div className="max-w-[1400px] mx-auto px-6">
                <AnimatedSection className="text-center mb-16">
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-[var(--text-secondary)] font-medium tracking-widest uppercase mb-4"
                    >
                        Bộ Sưu Tập
                    </motion.p>
                    <h1 className="text-5xl md:text-7xl font-bold text-[var(--text-primary)] tracking-tight mb-6">
                        Sản Phẩm
                    </h1>
                    <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto">
                        Khám phá bộ sưu tập mô hình 3D độc đáo, được chế tác thủ công với chất lượng cao nhất
                    </p>
                </AnimatedSection>

                <AnimatedSection delay={0.15} className="max-w-md mx-auto mb-8">
                    <div className="relative">
                        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" strokeWidth={1.5} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm sản phẩm..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-[var(--material-panel)] border border-[var(--border-color)] rounded-full text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                <X size={20} strokeWidth={2} />
                            </button>
                        )}
                    </div>
                </AnimatedSection>

                <AnimatedSection delay={0.2} className="flex justify-center mb-12">
                    <div className="inline-flex bg-[var(--material-panel)] rounded-full p-1 flex-wrap justify-center gap-1">
                        <button
                            onClick={() => setActiveCategory('Tất cả')}
                            className={`
                                px-6 py-3 rounded-full text-sm font-medium transition-all
                                ${activeCategory === 'Tất cả'
                                    ? 'bg-white text-[var(--bg-void)]'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }
                            `}
                        >
                            Tất cả
                        </button>
                        {categories.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => setActiveCategory(category.name)}
                                className={`
                                    px-6 py-3 rounded-full text-sm font-medium transition-all
                                    ${activeCategory === category.name
                                        ? 'bg-white text-[var(--bg-void)]'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }
                                `}
                            >
                                {category.name}
                            </button>
                        ))}
                    </div>
                </AnimatedSection>

                <AnimatedSection delay={0.25} className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <p className="text-[var(--text-secondary)] text-sm">
                        {loading ? 'Đang tải...' : `${filteredProducts.length} sản phẩm`}
                        {searchQuery && <span className="text-[var(--text-tertiary)]"> cho &quot;{searchQuery}&quot;</span>}
                    </p>

                    <div className="flex items-center gap-3">
                        <span className="text-[var(--text-secondary)] text-sm hidden sm:inline">Sắp xếp:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="bg-[var(--material-panel)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent)] cursor-pointer"
                        >
                            <option value="newest">Mới nhất</option>
                            <option value="price_asc">Giá thấp → cao</option>
                            <option value="price_desc">Giá cao → thấp</option>
                            <option value="bestseller">Bán chạy</option>
                        </select>
                    </div>
                </AnimatedSection>

                {loading && <ProductGridSkeletonUI count={8} />}

                {!loading && (
                    <motion.div
                        layout
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    >
                        {filteredProducts.map((product, index) => {
                            const colors = getColors(index);
                            return (
                                <AnimatedSection key={product.id} delay={index * 0.05}>
                                    <Link href={`/products/${product.id}`}>
                                        <motion.div
                                            layout
                                            whileHover={{ y: -8 }}
                                            onHoverStart={() => setHoveredProduct(product.id)}
                                            onHoverEnd={() => setHoveredProduct(null)}
                                            className="group relative bg-[var(--material-panel)] rounded-3xl overflow-hidden border border-[var(--border-color)]"
                                        >
                                            <div
                                                className="aspect-square flex items-center justify-center relative overflow-hidden"
                                                style={{
                                                    background: `linear-gradient(135deg, ${colors[0]}20, ${colors[1]}20)`
                                                }}
                                            >
                                                <motion.div
                                                    animate={{
                                                        scale: hoveredProduct === product.id ? 1.5 : 1,
                                                        rotate: hoveredProduct === product.id ? 180 : 0,
                                                    }}
                                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                                    className="absolute inset-0 opacity-30"
                                                    style={{
                                                        background: `radial-gradient(circle at center, ${colors[0]}40, transparent 70%)`
                                                    }}
                                                />

                                                {product.images?.[0] ? (
                                                    <motion.img
                                                        src={typeof product.images[0] === 'string' ? product.images[0] : product.images[0].url}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover relative z-10"
                                                        animate={{
                                                            scale: hoveredProduct === product.id ? 1.1 : 1,
                                                        }}
                                                        transition={{ duration: 0.4 }}
                                                    />
                                                ) : (
                                                    <motion.span
                                                        className="text-8xl relative z-10"
                                                        animate={{
                                                            scale: hoveredProduct === product.id ? 1.2 : 1,
                                                        }}
                                                        transition={{ duration: 0.4 }}
                                                    >
                                                        <Box size={32} className="text-[var(--text-secondary)]" strokeWidth={1.5} />
                                                    </motion.span>
                                                )}

                                                {product.is_featured && (
                                                    <span className="absolute top-4 left-4 px-3 py-1 bg-yellow-400/90 text-black text-xs font-bold rounded-full z-20 flex items-center gap-1">
                                                        <Star size={12} fill="currentColor" strokeWidth={0} />
                                                        Nổi bật
                                                    </span>
                                                )}

                                                {product.sale_price && (
                                                    <span className="absolute top-4 right-4 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full z-20">
                                                        SALE
                                                    </span>
                                                )}

                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: hoveredProduct === product.id ? 1 : 0 }}
                                                    className="absolute inset-0 bg-black/40 flex items-center justify-center z-20"
                                                >
                                                    <span className="px-4 py-2 rounded-full bg-white text-[var(--bg-void)] text-sm font-medium">
                                                        Xem chi tiết
                                                    </span>
                                                </motion.div>
                                            </div>

                                            <div className="p-5">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-secondary)] transition-colors line-clamp-1">
                                                            {product.name}
                                                        </h3>
                                                        <p className="text-sm text-[var(--text-tertiary)] mt-1">
                                                            {product.sku}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[var(--text-primary)] font-medium whitespace-nowrap">
                                                            {getDisplayPrice(product)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </Link>
                                </AnimatedSection>
                            );
                        })}
                    </motion.div>
                )}

                {!loading && filteredProducts.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--material-glass)] flex items-center justify-center">
                            <Box size={40} className="text-[var(--text-tertiary)]" strokeWidth={1.5} />
                        </div>
                        <p className="text-[var(--text-secondary)] mb-4">
                            {products.length === 0
                                ? 'Chưa có sản phẩm nào'
                                : 'Không có sản phẩm nào trong danh mục này'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
