'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { AnimatedSection } from '../ui/Animations';

const products = [
    { id: 1, name: 'Dragon Figure', price: 350000, emoji: '🐉' },
    { id: 2, name: 'Superhero Bust', price: 450000, emoji: '🦸' },
    { id: 3, name: 'Anime Character', price: 280000, emoji: '🦊' },
    { id: 4, name: 'Gaming Trophy', price: 320000, emoji: '🎮' },
];

export function FeaturedProducts() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ['start end', 'end start'],
    });

    const y = useTransform(scrollYProgress, [0, 1], [100, -100]);

    return (
        <section ref={containerRef} className="py-24 md:py-32 px-6 bg-[#F5F5F7]">
            <div className="max-w-[1400px] mx-auto">
                {/* Section Header */}
                <AnimatedSection className="text-center mb-16">
                    <h2 className="text-4xl md:text-6xl font-bold text-[#1D1D1F] mb-4 tracking-tight">
                        Sản Phẩm Nổi Bật
                    </h2>
                    <p className="text-lg text-[#6E6E73] max-w-xl mx-auto">
                        Những sản phẩm được yêu thích nhất
                    </p>
                </AnimatedSection>

                {/* Products Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {products.map((product, index) => (
                        <AnimatedSection key={product.id} delay={index * 0.1}>
                            <Link href={`/products/${product.id}`} data-cursor data-cursor-text="View">
                                <motion.div
                                    whileHover={{ y: -8 }}
                                    transition={{ duration: 0.3 }}
                                    className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-500"
                                >
                                    {/* Product Image */}
                                    <div className="aspect-square bg-[#F5F5F7] flex items-center justify-center relative overflow-hidden">
                                        <motion.span
                                            className="text-8xl transform group-hover:scale-125 transition-transform duration-700"
                                            style={{ y }}
                                        >
                                            {product.emoji}
                                        </motion.span>

                                        {/* Quick View Overlay */}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                            <span className="text-white text-sm font-medium px-4 py-2 rounded-full border border-white/50">
                                                Xem chi tiết
                                            </span>
                                        </div>
                                    </div>

                                    {/* Product Info */}
                                    <div className="p-5">
                                        <h3 className="font-semibold text-[#1D1D1F] mb-1 group-hover:text-[#0071E3] transition-colors">
                                            {product.name}
                                        </h3>
                                        <p className="text-[#6E6E73]">
                                            {product.price.toLocaleString('vi-VN')}đ
                                        </p>
                                    </div>
                                </motion.div>
                            </Link>
                        </AnimatedSection>
                    ))}
                </div>

                {/* View All Link */}
                <AnimatedSection delay={0.5} className="text-center mt-12">
                    <Link
                        href="/products"
                        className="inline-flex items-center gap-2 text-[#0071E3] font-medium text-lg hover:gap-4 transition-all"
                        data-cursor
                    >
                        Xem tất cả sản phẩm
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </Link>
                </AnimatedSection>
            </div>
        </section>
    );
}
