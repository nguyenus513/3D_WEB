'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/Button';

// Mock product data
const products: Record<number, {
    id: number;
    name: string;
    price: number;
    description: string;
    category: string;
    emoji: string;
    colors: string[];
    sizes: { name: string; price: number }[];
    details: string[];
}> = {
    1: {
        id: 1,
        name: 'Dragon Figure',
        price: 350000,
        description: 'Mô hình rồng 3D được chế tác tỉ mỉ với chi tiết sắc nét. Phù hợp làm quà tặng hoặc trang trí.',
        category: 'Figure',
        emoji: '🐉',
        colors: ['#FF6B6B', '#4ECDC4'],
        sizes: [
            { name: 'S (10cm)', price: 350000 },
            { name: 'M (15cm)', price: 450000 },
            { name: 'L (20cm)', price: 600000 },
        ],
        details: [
            'Chất liệu: Resin cao cấp',
            'Thời gian sản xuất: 5-7 ngày',
            'Bảo hành: 30 ngày',
            'Giao hàng toàn quốc',
        ],
    },
    2: {
        id: 2,
        name: 'Superhero Bust',
        price: 450000,
        description: 'Bust siêu anh hùng chi tiết cao. In 3D với công nghệ Resin, sơn thủ công.',
        category: 'Bust',
        emoji: '🦸',
        colors: ['#0071E3', '#FF9500'],
        sizes: [
            { name: 'S (8cm)', price: 450000 },
            { name: 'M (12cm)', price: 600000 },
            { name: 'L (16cm)', price: 800000 },
        ],
        details: [
            'Chất liệu: Resin cao cấp',
            'Thời gian sản xuất: 7-10 ngày',
            'Bảo hành: 30 ngày',
            'Giao hàng toàn quốc',
        ],
    },
};

// Default product for unknown IDs
const defaultProduct = {
    id: 0,
    name: 'Sản phẩm',
    price: 300000,
    description: 'Mô hình 3D độc đáo được chế tác thủ công.',
    category: 'Figure',
    emoji: '🎭',
    colors: ['#0071E3', '#A855F7'],
    sizes: [
        { name: 'S', price: 300000 },
        { name: 'M', price: 400000 },
        { name: 'L', price: 550000 },
    ],
    details: [
        'Chất liệu: Resin cao cấp',
        'Thời gian sản xuất: 5-7 ngày',
        'Bảo hành: 30 ngày',
    ],
};

export default function ProductDetailPage() {
    const params = useParams();
    const productId = Number(params.id);
    const product = products[productId] || { ...defaultProduct, id: productId };

    const [selectedSize, setSelectedSize] = useState(0);
    const [quantity, setQuantity] = useState(1);

    const currentPrice = product.sizes[selectedSize]?.price || product.price;

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[1400px] mx-auto px-6">
                {/* Breadcrumb */}
                <nav className="mb-8">
                    <ol className="flex items-center gap-2 text-sm text-white/50">
                        <li><Link href="/" className="hover:text-white transition-colors">Trang chủ</Link></li>
                        <li>/</li>
                        <li><Link href="/products" className="hover:text-white transition-colors">Sản phẩm</Link></li>
                        <li>/</li>
                        <li className="text-white">{product.name}</li>
                    </ol>
                </nav>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
                    {/* Left - Product Image/3D */}
                    <AnimatedSection animation="fadeIn">
                        <div
                            className="aspect-square rounded-3xl flex items-center justify-center relative overflow-hidden"
                            style={{
                                background: `linear-gradient(135deg, ${product.colors[0]}30, ${product.colors[1]}20)`
                            }}
                        >
                            {/* Animated background */}
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                                className="absolute inset-0 opacity-20"
                                style={{
                                    background: `conic-gradient(from 0deg, ${product.colors[0]}, ${product.colors[1]}, ${product.colors[0]})`
                                }}
                            />

                            {/* Product Display */}
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.8 }}
                                className="relative z-10"
                            >
                                <span className="text-[200px] md:text-[250px]">{product.emoji}</span>
                            </motion.div>

                            {/* Placeholder for 3D model */}
                            <div className="absolute bottom-4 left-4 right-4 flex justify-center">
                                <span className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-xl text-white/60 text-sm">
                                    🔄 Kéo để xoay 3D
                                </span>
                            </div>
                        </div>
                    </AnimatedSection>

                    {/* Right - Product Info */}
                    <div className="flex flex-col">
                        <AnimatedSection delay={0.1}>
                            <span className="text-sm text-[#0071E3] font-medium tracking-widest uppercase">
                                {product.category}
                            </span>
                            <h1 className="text-4xl md:text-5xl font-bold text-white mt-2 mb-4">
                                {product.name}
                            </h1>
                            <p className="text-white/60 text-lg mb-8">
                                {product.description}
                            </p>
                        </AnimatedSection>

                        {/* Price */}
                        <AnimatedSection delay={0.2}>
                            <div className="mb-8">
                                <span className="text-3xl font-bold text-white">
                                    {currentPrice.toLocaleString('vi-VN')}đ
                                </span>
                            </div>
                        </AnimatedSection>

                        {/* Size Selection */}
                        <AnimatedSection delay={0.3}>
                            <div className="mb-8">
                                <h3 className="text-sm font-medium text-white/70 mb-3">Kích thước</h3>
                                <div className="flex flex-wrap gap-3">
                                    {product.sizes.map((size, index) => (
                                        <button
                                            key={size.name}
                                            onClick={() => setSelectedSize(index)}
                                            className={`
                        px-6 py-3 rounded-full text-sm font-medium transition-all
                        ${selectedSize === index
                                                    ? 'bg-white text-[#0a0a0a]'
                                                    : 'bg-[#1D1D1F] text-white hover:bg-[#2D2D2F]'
                                                }
                      `}
                                            data-cursor
                                        >
                                            {size.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </AnimatedSection>

                        {/* Quantity */}
                        <AnimatedSection delay={0.4}>
                            <div className="mb-8">
                                <h3 className="text-sm font-medium text-white/70 mb-3">Số lượng</h3>
                                <div className="inline-flex items-center bg-[#1D1D1F] rounded-full">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="w-12 h-12 flex items-center justify-center text-white hover:text-[#0071E3] transition-colors"
                                        data-cursor
                                    >
                                        −
                                    </button>
                                    <span className="w-12 text-center text-white font-medium">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(quantity + 1)}
                                        className="w-12 h-12 flex items-center justify-center text-white hover:text-[#0071E3] transition-colors"
                                        data-cursor
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </AnimatedSection>

                        {/* Actions */}
                        <AnimatedSection delay={0.5}>
                            <div className="flex flex-col sm:flex-row gap-4 mb-8">
                                <Button variant="primary" size="lg" className="flex-1" data-cursor>
                                    Thêm vào giỏ
                                </Button>
                                <Button variant="secondary" size="lg" className="flex-1" data-cursor>
                                    Mua ngay
                                </Button>
                            </div>
                        </AnimatedSection>

                        {/* Details */}
                        <AnimatedSection delay={0.6}>
                            <div className="border-t border-white/10 pt-8">
                                <h3 className="text-sm font-medium text-white/70 mb-4">Chi tiết sản phẩm</h3>
                                <ul className="space-y-3">
                                    {product.details.map((detail, index) => (
                                        <li key={index} className="flex items-center gap-3 text-white/60">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3]" />
                                            {detail}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </AnimatedSection>
                    </div>
                </div>
            </div>
        </div>
    );
}
