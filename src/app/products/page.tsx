'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import { getSupabase } from '@/lib/supabase/client';
import type { Product } from '@/types/database';

const categories = ['Tất cả', 'Figure', 'Bust', 'Trophy', 'Custom', 'Accessory'];

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('Tất cả');
    const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);

    useEffect(() => {
        fetchProducts();
    }, []);

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

    const filteredProducts = activeCategory === 'Tất cả'
        ? products
        : products.filter(p => p.tags?.includes(activeCategory) || p.type === activeCategory.toLowerCase());

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

                {/* Category Tabs */}
                <AnimatedSection delay={0.2} className="flex justify-center mb-12">
                    <div className="inline-flex bg-[#1D1D1F] rounded-full p-1 flex-wrap justify-center gap-1">
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`
                                    px-6 py-3 rounded-full text-sm font-medium transition-all
                                    ${activeCategory === category
                                        ? 'bg-white text-[#0a0a0a]'
                                        : 'text-white/70 hover:text-white'
                                    }
                                `}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </AnimatedSection>

                {/* Loading */}
                {loading && (
                    <div className="text-center py-20">
                        <div className="inline-block w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
                        <p className="text-white/50">Đang tải sản phẩm...</p>
                    </div>
                )}

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
                                                        📦
                                                    </motion.span>
                                                )}

                                                {/* Featured badge */}
                                                {product.is_featured && (
                                                    <span className="absolute top-4 left-4 px-3 py-1 bg-yellow-400/90 text-black text-xs font-bold rounded-full z-20">
                                                        ⭐ Nổi bật
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
                        <p className="text-6xl mb-4">📦</p>
                        <p className="text-white/50 mb-4">
                            {products.length === 0
                                ? 'Chưa có sản phẩm nào'
                                : 'Không có sản phẩm nào trong danh mục này'}
                        </p>
                        {products.length === 0 && (
                            <Link
                                href="/admin/products/new"
                                className="inline-block px-6 py-3 bg-white text-black rounded-full font-medium hover:bg-white/90 transition-colors"
                            >
                                Thêm sản phẩm đầu tiên
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
