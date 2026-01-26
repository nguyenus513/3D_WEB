'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import { getSupabase } from '@/lib/supabase/client';
import { useCartStore } from '@/lib/store/cart';
import type { Product } from '@/types/database';

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const productId = params.id as string;

    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedSize, setSelectedSize] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [addedToCart, setAddedToCart] = useState(false);

    const addItem = useCartStore(state => state.addItem);

    useEffect(() => {
        fetchProduct();
    }, [productId]);

    const fetchProduct = async () => {
        const supabase = getSupabase();

        // Try to fetch by ID (UUID) or slug
        let query = supabase.from('products').select('*');

        // Check if it's a UUID or slug
        if (productId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            query = query.eq('id', productId);
        } else {
            query = query.eq('slug', productId);
        }

        const { data, error } = await query.single();

        if (error || !data) {
            setLoading(false);
            return;
        }

        setProduct(data);
        setLoading(false);
    };

    const handleAddToCart = () => {
        if (!product) return;

        const size = product.sizes?.[selectedSize];
        const price = size?.price || product.sale_price || product.base_price;

        addItem({
            type: 'product',
            productId: product.id,
            name: product.name,
            sku: product.sku,
            price: price,
            quantity: quantity,
            size: size?.name || 'Default',
            image: product.images?.[0]?.url,
        });

        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2000);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-32 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white/50">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-32 flex items-center justify-center px-6">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-white mb-4">Không tìm thấy sản phẩm</h1>
                    <p className="text-white/50 mb-8">Sản phẩm này không tồn tại hoặc đã bị xóa.</p>
                    <Link href="/products" className="px-6 py-3 bg-white text-black rounded-xl font-medium">
                        Xem sản phẩm khác
                    </Link>
                </div>
            </div>
        );
    }

    const currentPrice = product.sizes?.[selectedSize]?.price || product.sale_price || product.base_price;
    const hasDiscount = product.sale_price && product.sale_price < product.base_price;

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-20">
            <div className="max-w-[1400px] mx-auto px-6">
                {/* Breadcrumb */}
                <nav className="mb-8">
                    <ol className="flex items-center gap-2 text-sm text-white/50">
                        <li><Link href="/" className="hover:text-white">Trang chủ</Link></li>
                        <li>/</li>
                        <li><Link href="/products" className="hover:text-white">Sản phẩm</Link></li>
                        <li>/</li>
                        <li className="text-white">{product.name}</li>
                    </ol>
                </nav>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
                    {/* Left - Product Image */}
                    <AnimatedSection animation="fadeIn">
                        <div className="aspect-square rounded-3xl bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center relative overflow-hidden">
                            {product.images?.[0]?.url ? (
                                <img
                                    src={product.images[0].url}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-[200px]"
                                >
                                    🎭
                                </motion.div>
                            )}

                            {hasDiscount && (
                                <div className="absolute top-4 left-4 px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-full">
                                    SALE
                                </div>
                            )}
                        </div>
                    </AnimatedSection>

                    {/* Right - Product Info */}
                    <div className="flex flex-col">
                        <AnimatedSection delay={0.1}>
                            {product.tags?.[0] && (
                                <span className="text-sm text-white/50 font-medium tracking-widest uppercase">
                                    {product.tags[0]}
                                </span>
                            )}
                            <h1 className="text-4xl md:text-5xl font-bold text-white mt-2 mb-4">
                                {product.name}
                            </h1>
                            <p className="text-white/60 text-lg mb-8">
                                {product.short_description || product.description}
                            </p>
                        </AnimatedSection>

                        {/* Price */}
                        <AnimatedSection delay={0.2}>
                            <div className="mb-8 flex items-center gap-4">
                                <span className="text-3xl font-bold text-white">
                                    {currentPrice.toLocaleString('vi-VN')}đ
                                </span>
                                {hasDiscount && (
                                    <span className="text-xl text-white/40 line-through">
                                        {product.base_price.toLocaleString('vi-VN')}đ
                                    </span>
                                )}
                            </div>
                        </AnimatedSection>

                        {/* Size Selection */}
                        {product.sizes && product.sizes.length > 0 && (
                            <AnimatedSection delay={0.3}>
                                <div className="mb-8">
                                    <h3 className="text-sm font-medium text-white/70 mb-3">Kích thước</h3>
                                    <div className="flex flex-wrap gap-3">
                                        {product.sizes.filter(s => s.enabled).map((size, index) => (
                                            <button
                                                key={size.name}
                                                onClick={() => setSelectedSize(index)}
                                                className={`px-4 py-3 rounded-xl border transition-all ${selectedSize === index
                                                    ? 'bg-white text-black border-white'
                                                    : 'bg-transparent text-white/70 border-white/20 hover:border-white/40'
                                                    }`}
                                            >
                                                <span className="block text-sm font-medium">{size.name}</span>
                                                <span className="block text-xs opacity-70">
                                                    {size.price.toLocaleString('vi-VN')}đ
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </AnimatedSection>
                        )}

                        {/* Quantity */}
                        <AnimatedSection delay={0.4}>
                            <div className="mb-8">
                                <h3 className="text-sm font-medium text-white/70 mb-3">Số lượng</h3>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="w-12 h-12 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                                    >
                                        -
                                    </button>
                                    <span className="text-xl font-semibold text-white w-12 text-center">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(quantity + 1)}
                                        className="w-12 h-12 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </AnimatedSection>

                        {/* Add to Cart */}
                        <AnimatedSection delay={0.5}>
                            <div className="flex gap-4">
                                <button
                                    onClick={handleAddToCart}
                                    className={`flex-1 py-4 rounded-xl font-semibold transition-all ${addedToCart
                                        ? 'bg-green-500 text-white'
                                        : 'bg-white text-black hover:bg-white/90'
                                        }`}
                                >
                                    {addedToCart ? '✓ Đã thêm vào giỏ' : 'Thêm vào giỏ hàng'}
                                </button>
                                <Link
                                    href="/cart"
                                    className="px-6 py-4 rounded-xl border border-white/20 text-white hover:bg-white/10"
                                >
                                    Xem giỏ
                                </Link>
                            </div>
                        </AnimatedSection>

                        {/* Product Details */}
                        <AnimatedSection delay={0.6}>
                            <div className="mt-12 pt-8 border-t border-white/10">
                                <h3 className="text-lg font-semibold text-white mb-4">Chi tiết sản phẩm</h3>
                                <div className="prose prose-invert max-w-none">
                                    <p className="text-white/60">{product.description}</p>
                                </div>
                                <ul className="mt-4 space-y-2">
                                    <li className="flex items-center gap-2 text-white/60">
                                        <span className="w-2 h-2 rounded-full bg-green-400" />
                                        SKU: {product.sku}
                                    </li>
                                    <li className="flex items-center gap-2 text-white/60">
                                        <span className="w-2 h-2 rounded-full bg-green-400" />
                                        Còn hàng: {product.stock} sản phẩm
                                    </li>
                                </ul>
                            </div>
                        </AnimatedSection>
                    </div>
                </div>
            </div>
        </div>
    );
}
