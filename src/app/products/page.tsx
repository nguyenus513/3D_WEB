'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { getSupabase } from '@/lib/supabase/client';
import type { Product } from '@/types/database';

interface Category {
    id: string;
    name: string;
    slug: string;
}

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'bestseller';

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
        const supabase = getSupabase();
        const { data } = await supabase
            .from('categories')
            .select('*')
            .order('sort_order', { ascending: true });
        setCategories(data || []);
    };

    const fetchProducts = async () => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setProducts(data);
        }
        setLoading(false);
    };

    // Filter and sort products
    const filteredProducts = products
        .filter(p => {
            // Category filter
            const matchesCategory = activeCategory === 'Tất cả'
                || p.category_id === categories.find(c => c.name === activeCategory)?.id;

            // Search filter
            const searchLower = searchQuery.toLowerCase().trim();
            const matchesSearch = !searchLower ||
                p.name.toLowerCase().includes(searchLower) ||
                p.sku?.toLowerCase().includes(searchLower) ||
                p.short_description?.toLowerCase().includes(searchLower);

            // Price filter
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

    // Generate gradient colors from product
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
        <div className="min-h-screen bg-[#0a0a0a] pt-32 pb-20">
            <div className="max-w-[1400px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="text-center mb-16">
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-white/70 font-medium tracking-widest uppercase mb-4"
                    >
                        Bộ Sưu Tập
                    </motion.p>
                    <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-6">
                        Sản Phẩm
                    </h1>
                    <p className="text-lg text-white/50 max-w-xl mx-auto">
                        Khám phá bộ sưu tập mô hình 3D độc đáo, được chế tác thủ công với chất lượng cao nhất
                    </p>
                </AnimatedSection>

                {/* Search Bar */}
                <AnimatedSection delay={0.15} className="max-w-md mx-auto mb-8">
                    <div className="relative">
                        <svg
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        <input
                            type="text"
                            placeholder="Tìm kiếm sản phẩm..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-[#1D1D1F] border border-white/10 rounded-full text-white placeholder:text-white/30 focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 hover:text-white transition-colors"
                            >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </AnimatedSection>

                {/* Category Tabs */}
                <AnimatedSection delay={0.2} className="flex justify-center mb-12">
                    <div className="inline-flex bg-[#1D1D1F] rounded-full p-1 flex-wrap justify-center gap-1">
                        <button
                            onClick={() => setActiveCategory('Tất cả')}
                            className={`
                                px-6 py-3 rounded-full text-sm font-medium transition-all
                                ${activeCategory === 'Tất cả'
                                    ? 'bg-white text-[#0a0a0a]'
                                    : 'text-white/70 hover:text-white'
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
                                        ? 'bg-white text-[#0a0a0a]'
                                        : 'text-white/70 hover:text-white'
                                    }
                                `}
                            >
                                {category.name}
                            </button>
                        ))}
                    </div>
                </AnimatedSection>

                {/* Sort & Filter Bar */}
                <AnimatedSection delay={0.25} className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    {/* Results count */}
                    <p className="text-white/50 text-sm">
                        {loading ? 'Đang tải...' : `${filteredProducts.length} sản phẩm`}
                        {searchQuery && <span className="text-white/30"> cho &quot;{searchQuery}&quot;</span>}
                    </p>

                    {/* Sort dropdown */}
                    <div className="flex items-center gap-3">
                        <span className="text-white/50 text-sm hidden sm:inline">Sắp xếp:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="bg-[#1D1D1F] border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#0071E3] cursor-pointer"
                        >
                            <option value="newest">Mới nhất</option>
                            <option value="price_asc">Giá thấp → cao</option>
                            <option value="price_desc">Giá cao → thấp</option>
                            <option value="bestseller">Bán chạy</option>
                        </select>
                    </div>
                </AnimatedSection>

                {/* Loading Skeleton */}
                {loading && <ProductGridSkeleton count={8} />}

                {/* Products Grid */}
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
                                            className="group relative bg-[#1D1D1F] rounded-3xl overflow-hidden border border-white/5"
                                        >
                                            {/* Product Image Area */}
                                            <div
                                                className="aspect-square flex items-center justify-center relative overflow-hidden"
                                                style={{
                                                    background: `linear-gradient(135deg, ${colors[0]}20, ${colors[1]}20)`
                                                }}
                                            >
                                                {/* Animated background */}
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

                                                {/* Product Image or Emoji */}
                                                {product.images?.[0]?.url ? (
                                                    <motion.img
                                                        src={product.images[0].url}
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
                                                        <svg className="w-8 h-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                        </svg>
                                                    </motion.span>
                                                )}

                                                {/* Featured badge */}
                                                {product.is_featured && (
                                                    <span className="absolute top-4 left-4 px-3 py-1 bg-yellow-400/90 text-black text-xs font-bold rounded-full z-20 flex items-center gap-1">
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                        </svg>
                                                        Nổi bật
                                                    </span>
                                                )}

                                                {/* Sale badge */}
                                                {product.sale_price && (
                                                    <span className="absolute top-4 right-4 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full z-20">
                                                        SALE
                                                    </span>
                                                )}

                                                {/* Hover overlay */}
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: hoveredProduct === product.id ? 1 : 0 }}
                                                    className="absolute inset-0 bg-black/40 flex items-center justify-center z-20"
                                                >
                                                    <span className="px-4 py-2 rounded-full bg-white text-[#0a0a0a] text-sm font-medium">
                                                        Xem chi tiết
                                                    </span>
                                                </motion.div>
                                            </div>

                                            {/* Product Info */}
                                            <div className="p-5">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h3 className="font-semibold text-white group-hover:text-white/70 transition-colors line-clamp-1">
                                                            {product.name}
                                                        </h3>
                                                        <p className="text-sm text-white/40 mt-1">
                                                            {product.sku}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        {product.sale_price ? (
                                                            <>
                                                                <p className="text-white font-medium">
                                                                    {Number(product.sale_price).toLocaleString('vi-VN')}đ
                                                                </p>
                                                                <p className="text-sm text-white/40 line-through">
                                                                    {Number(product.base_price).toLocaleString('vi-VN')}đ
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <p className="text-white font-medium whitespace-nowrap">
                                                                {Number(product.base_price).toLocaleString('vi-VN')}đ
                                                            </p>
                                                        )}
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

                {/* Empty State */}
                {!loading && filteredProducts.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                            <svg className="w-10 h-10 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                        <p className="text-white/50 mb-4">
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
