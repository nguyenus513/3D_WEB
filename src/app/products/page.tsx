'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';

// Mock product data
const products = [
    { id: 1, name: 'Dragon Figure', price: 350000, category: 'Figure', emoji: '🐉', colors: ['#FF6B6B', '#4ECDC4'] },
    { id: 2, name: 'Superhero Bust', price: 450000, category: 'Bust', emoji: '🦸', colors: ['#0071E3', '#FF9500'] },
    { id: 3, name: 'Anime Character', price: 280000, category: 'Figure', emoji: '🦊', colors: ['#FF6B6B', '#A855F7'] },
    { id: 4, name: 'Gaming Trophy', price: 320000, category: 'Trophy', emoji: '🎮', colors: ['#30D158', '#0071E3'] },
    { id: 5, name: 'Pet Portrait', price: 380000, category: 'Portrait', emoji: '🐕', colors: ['#FFD60A', '#FF9500'] },
    { id: 6, name: 'Couple Figure', price: 520000, category: 'Figure', emoji: '💑', colors: ['#FF6B6B', '#A855F7'] },
    { id: 7, name: 'Chibi Character', price: 250000, category: 'Figure', emoji: '🎭', colors: ['#4ECDC4', '#0071E3'] },
    { id: 8, name: 'Custom Bust', price: 480000, category: 'Bust', emoji: '🗿', colors: ['#6E6E73', '#1D1D1F'] },
];

const categories = ['Tất cả', 'Figure', 'Bust', 'Trophy', 'Portrait'];

export default function ProductsPage() {
    const [activeCategory, setActiveCategory] = useState('Tất cả');
    const [hoveredProduct, setHoveredProduct] = useState<number | null>(null);

    const filteredProducts = activeCategory === 'Tất cả'
        ? products
        : products.filter(p => p.category === activeCategory);

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
                    <div className="inline-flex bg-[#1D1D1F] rounded-full p-1">
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
                                data-cursor
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </AnimatedSection>

                {/* Products Grid */}
                <motion.div
                    layout
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                >
                    {filteredProducts.map((product, index) => (
                        <AnimatedSection key={product.id} delay={index * 0.05}>
                            <Link href={`/products/${product.id}`} data-cursor data-cursor-text="View">
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
                                            background: `linear-gradient(135deg, ${product.colors[0]}20, ${product.colors[1]}20)`
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
                                                background: `radial-gradient(circle at center, ${product.colors[0]}40, transparent 70%)`
                                            }}
                                        />

                                        {/* Product Emoji */}
                                        <motion.span
                                            className="text-8xl relative z-10"
                                            animate={{
                                                scale: hoveredProduct === product.id ? 1.2 : 1,
                                                rotateY: hoveredProduct === product.id ? 15 : 0,
                                            }}
                                            transition={{ duration: 0.4 }}
                                        >
                                            {product.emoji}
                                        </motion.span>

                                        {/* Hover overlay */}
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: hoveredProduct === product.id ? 1 : 0 }}
                                            className="absolute inset-0 bg-black/40 flex items-center justify-center"
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
                                                <h3 className="font-semibold text-white group-hover:text-white/70 transition-colors">
                                                    {product.name}
                                                </h3>
                                                <p className="text-sm text-white/40 mt-1">
                                                    {product.category}
                                                </p>
                                            </div>
                                            <p className="text-white font-medium whitespace-nowrap">
                                                {product.price.toLocaleString('vi-VN')}đ
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            </Link>
                        </AnimatedSection>
                    ))}
                </motion.div>

                {/* Empty State */}
                {filteredProducts.length === 0 && (
                    <div className="text-center py-20">
                        <p className="text-white/50">Không có sản phẩm nào trong danh mục này</p>
                    </div>
                )}
            </div>
        </div>
    );
}
