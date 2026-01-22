'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { AnimatedSection } from '../ui/Animations';

interface FeaturedProduct {
    id: string;
    name: string;
    slug: string;
    base_price: number;
    sale_price: number | null;
    images: { url: string; alt?: string }[] | null;
    short_description: string | null;
}

export function FeaturedProducts() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [products, setProducts] = useState<FeaturedProduct[]>([]);
    const [loading, setLoading] = useState(true);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ['start end', 'end start'],
    });

    const y = useTransform(scrollYProgress, [0, 1], [100, -100]);

    useEffect(() => {
        const fetchFeaturedProducts = async () => {
            try {
                const response = await fetch('/api/featured-products');
                const data = await response.json();
                setProducts(data.products || []);
            } catch (error) {
                console.error('Error fetching featured products:', error);
            }
            setLoading(false);
        };

        fetchFeaturedProducts();
    }, []);

    const getProductImage = (product: FeaturedProduct) => {
        if (product.images && product.images.length > 0) {
            return product.images[0].url;
        }
        return null;
    };

    // Don't render section if no products
    if (!loading && products.length === 0) {
        return null;
    }

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

                {/* Loading State */}
                {loading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="bg-white rounded-3xl overflow-hidden animate-pulse">
                                <div className="aspect-square bg-gray-200" />
                                <div className="p-5">
                                    <div className="h-5 bg-gray-200 rounded mb-2 w-3/4" />
                                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Products Grid */}
                {!loading && products.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {products.map((product, index) => (
                            <AnimatedSection key={product.id} delay={index * 0.1}>
                                <Link href={`/products/${product.slug}`} data-cursor data-cursor-text="View">
                                    <motion.div
                                        whileHover={{ y: -8 }}
                                        transition={{ duration: 0.3 }}
                                        className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-500"
                                    >
                                        {/* Product Image */}
                                        <div className="aspect-square bg-[#F5F5F7] flex items-center justify-center relative overflow-hidden">
                                            {getProductImage(product) ? (
                                                <motion.img
                                                    src={getProductImage(product)!}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                                    style={{ y }}
                                                />
                                            ) : (
                                                <motion.div
                                                    className="transform group-hover:scale-125 transition-transform duration-700"
                                                    style={{ y }}
                                                >
                                                    <svg className="w-20 h-20 text-[#1D1D1F]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                    </svg>
                                                </motion.div>
                                            )}

                                            {/* Quick View Overlay */}
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                                <span className="text-white text-sm font-medium px-4 py-2 rounded-full border border-white/50">
                                                    Xem chi tiết
                                                </span>
                                            </div>
                                        </div>

                                        {/* Product Info */}
                                        <div className="p-5">
                                            <h3 className="font-semibold text-[#1D1D1F] mb-1 group-hover:text-[#6E6E73] transition-colors line-clamp-1">
                                                {product.name}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[#1D1D1F] font-medium">
                                                    {(product.sale_price || product.base_price).toLocaleString('vi-VN')}đ
                                                </p>
                                                {product.sale_price && (
                                                    <p className="text-[#6E6E73] text-sm line-through">
                                                        {product.base_price.toLocaleString('vi-VN')}đ
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                </Link>
                            </AnimatedSection>
                        ))}
                    </div>
                )}

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
