'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { AnimatedSection } from '../ui/Animations';

const products = [
    {
        id: 1, name: 'Dragon Figure', price: 350000, icon: (
            <svg className="w-20 h-20 text-[#1D1D1F]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        )
    },
    {
        id: 2, name: 'Superhero Bust', price: 450000, icon: (
            <svg className="w-20 h-20 text-[#1D1D1F]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        )
    },
    {
        id: 3, name: 'Anime Character', price: 280000, icon: (
            <svg className="w-20 h-20 text-[#1D1D1F]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        )
    },
    {
        id: 4, name: 'Gaming Trophy', price: 320000, icon: (
            <svg className="w-20 h-20 text-[#1D1D1F]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
        )
    },
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
                                        <motion.div
                                            className="transform group-hover:scale-125 transition-transform duration-700"
                                            style={{ y }}
                                        >
                                            {product.icon}
                                        </motion.div>

                                        {/* Quick View Overlay */}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                            <span className="text-white text-sm font-medium px-4 py-2 rounded-full border border-white/50">
                                                Xem chi tiết
                                            </span>
                                        </div>
                                    </div>

                                    {/* Product Info */}
                                    <div className="p-5">
                                        <h3 className="font-semibold text-[#1D1D1F] mb-1 group-hover:text-[#6E6E73] transition-colors">
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
                        className="inline-flex items-center gap-2 text-[#1D1D1F] font-medium text-lg hover:gap-4 transition-all underline underline-offset-4"
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

