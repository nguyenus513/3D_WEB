'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedSection } from '@/components/ui/Animations';
import { useCartStore } from '@/lib/store/cart';
import type { Product } from '@/types/database';

// Variant type from API (product_variants table)
interface Variant {
    id: string;
    name: string;
    sku: string | null;
    price: number;
    stock: number;
    image_url: string | null;
    images: string[];
    is_active: boolean;
    sort_order: number;
}

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const productId = params.id as string;

    const [product, setProduct] = useState<Product | null>(null);
    const [variants, setVariants] = useState<Variant[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVariant, setSelectedVariant] = useState(0);
    const [selectedImage, setSelectedImage] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [addedToCart, setAddedToCart] = useState(false);

    const addItem = useCartStore(state => state.addItem);

    // Get product's general images
    const getProductImages = (): string[] => {
        if (!product) return [];
        return (product.images || []).map(img =>
            typeof img === 'string' ? img : img.url
        );
    };

    // Get current variant's images combined with product images
    const getCurrentImages = (): string[] => {
        if (!product) return [];

        const productImages = getProductImages();
        const variant = variants[selectedVariant];

        // Get variant-specific images
        let variantImages: string[] = [];
        if (variant?.images && variant.images.length > 0) {
            variantImages = variant.images;
        } else if (variant?.image_url) {
            variantImages = [variant.image_url];
        }

        // Combine: variant images FIRST, then product images (no duplicates)
        const combined = [...variantImages];
        productImages.forEach(img => {
            if (!combined.includes(img)) {
                combined.push(img);
            }
        });

        return combined.length > 0 ? combined : productImages;
    };

    // Navigation arrows
    const handlePrevImage = () => {
        const images = getCurrentImages();
        setSelectedImage(prev => (prev - 1 + images.length) % images.length);
    };

    const handleNextImage = () => {
        const images = getCurrentImages();
        setSelectedImage(prev => (prev + 1) % images.length);
    };

    // Reset selected image when variant changes
    const handleVariantChange = (index: number) => {
        setSelectedVariant(index);
        setSelectedImage(0);
    };

    // Handle Buy Now
    const handleBuyNow = () => {
        if (!product) return;

        const variant = variants[selectedVariant];
        const price = variant?.price || product.sale_price || product.base_price;

        addItem({
            type: 'product',
            productId: product.id,
            name: product.name,
            sku: variant?.sku || product.sku || undefined,
            price: price,
            quantity: quantity,
            size: variant?.name || 'Default',
            image: typeof product.images?.[0] === 'string' ? product.images[0] : product.images?.[0]?.url,
        });

        router.push('/checkout');
    };

    useEffect(() => {
        fetchProduct();
    }, [productId]);

    const fetchProduct = async () => {
        try {
            const res = await fetch(`/api/public/products`);
            const json = await res.json();
            const allProducts = json.data || [];

            // Find product by ID
            const found = allProducts.find((p: any) => p.id === productId);
            if (!found) {
                setLoading(false);
                return;
            }

            // Extract variants from joined data
            const productVariants: Variant[] = (found.product_variants || [])
                .filter((v: Variant) => v.is_active)
                .sort((a: Variant, b: Variant) => a.sort_order - b.sort_order);

            // Adapt images
            const imagesAdapted = (found.images || []).map((img: string | { url: string }) =>
                typeof img === 'string' ? { url: img } : img
            );

            setProduct({ ...found, images: imagesAdapted } as any);
            setVariants(productVariants);
        } catch {
            // Error fetching
        } finally {
            setLoading(false);
        }
    };

    const handleAddToCart = () => {
        if (!product) return;

        const variant = variants[selectedVariant];
        const price = variant?.price || product.sale_price || product.base_price;

        addItem({
            type: 'product',
            productId: product.id,
            name: product.name,
            sku: variant?.sku || product.sku || undefined,
            price: price,
            quantity: quantity,
            size: variant?.name || 'Default',
            image: typeof product.images?.[0] === 'string' ? product.images[0] : product.images?.[0]?.url,
        });

        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2000);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg-void)] pt-32 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-[var(--border-color)] border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[var(--text-secondary)]">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-[var(--bg-void)] pt-32 flex items-center justify-center px-6">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-4">Không tìm thấy sản phẩm</h1>
                    <p className="text-[var(--text-secondary)] mb-8">Sản phẩm này không tồn tại hoặc đã bị xóa.</p>
                    <Link href="/products" className="px-6 py-3 bg-white text-black rounded-xl font-medium">
                        Xem sản phẩm khác
                    </Link>
                </div>
            </div>
        );
    }

    const currentVariant = variants[selectedVariant];
    const currentPrice = currentVariant?.price || product.sale_price || product.base_price;
    const hasDiscount = product.sale_price && product.sale_price < product.base_price;

    return (
        <div className="min-h-screen bg-[var(--bg-void)] pt-28 pb-20">
            <div className="max-w-[1400px] mx-auto px-6">
                {/* Breadcrumb */}
                <nav className="mb-8">
                    <ol className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <li><Link href="/" className="hover:text-[var(--text-primary)]">Trang chủ</Link></li>
                        <li>/</li>
                        <li><Link href="/products" className="hover:text-[var(--text-primary)]">Sản phẩm</Link></li>
                        <li>/</li>
                        <li className="text-[var(--text-primary)]">{product.name}</li>
                    </ol>
                </nav>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
                    {/* Left - Product Gallery (based on selected size) */}
                    <AnimatedSection animation="fadeIn">
                        <div className="space-y-4">
                            {/* Main Image */}
                            <div className="aspect-square rounded-3xl bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center relative overflow-hidden">
                                {getCurrentImages()[selectedImage] ? (
                                    <motion.img
                                        key={`${selectedVariant}-${selectedImage}`}
                                        src={getCurrentImages()[selectedImage]}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3 }}
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
                                    <div className="absolute top-4 left-4 px-3 py-1 bg-red-500 text-[var(--text-primary)] text-sm font-medium rounded-full">
                                        SALE
                                    </div>
                                )}

                                {/* Navigation Arrows */}
                                {getCurrentImages().length > 1 && (
                                    <>
                                        <button
                                            onClick={handlePrevImage}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-[var(--text-primary)] transition-colors"
                                            aria-label="Previous image"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={handleNextImage}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-[var(--text-primary)] transition-colors"
                                            aria-label="Next image"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                        {/* Image counter */}
                                        <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/50 rounded-full text-[var(--text-primary)] text-xs">
                                            {selectedImage + 1} / {getCurrentImages().length}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Thumbnails */}
                            {getCurrentImages().length > 1 && (
                                <div className="flex gap-3 flex-wrap">
                                    {getCurrentImages().map((img, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedImage(idx)}
                                            className={`w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border-2 transition-all ${selectedImage === idx
                                                ? 'border-white scale-105'
                                                : 'border-[var(--border-color)] hover:border-[var(--border-color)]0'
                                                }`}
                                        >
                                            <img
                                                src={img}
                                                alt={`${product.name} ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Current variant label */}
                            {variants.length > 0 && (
                                <p className="text-sm text-[var(--text-secondary)] text-center">
                                    Đang xem: <span className="text-[var(--text-primary)] font-medium">{variants[selectedVariant]?.name}</span>
                                </p>
                            )}
                        </div>
                    </AnimatedSection>

                    {/* Right - Product Info */}
                    <div className="flex flex-col">
                        <AnimatedSection delay={0.1}>
                            {product.tags?.[0] && (
                                <span className="text-sm text-[var(--text-secondary)] font-medium tracking-widest uppercase">
                                    {product.tags[0]}
                                </span>
                            )}
                            <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] mt-2 mb-4">
                                {product.name}
                            </h1>
                            <p className="text-[var(--text-secondary)] text-lg mb-8">
                                {product.short_description || product.description}
                            </p>
                        </AnimatedSection>

                        {/* Price */}
                        <AnimatedSection delay={0.2}>
                            <div className="mb-8 flex items-center gap-4">
                                <span className="text-3xl font-bold text-[var(--text-primary)]">
                                    {currentPrice.toLocaleString('vi-VN')}đ
                                </span>
                                {hasDiscount && (
                                    <span className="text-xl text-[var(--text-tertiary)] line-through">
                                        {product.base_price.toLocaleString('vi-VN')}đ
                                    </span>
                                )}
                            </div>
                        </AnimatedSection>

                        {/* Variant Selection */}
                        {variants.length > 0 && (
                            <AnimatedSection delay={0.3}>
                                <div className="mb-8">
                                    <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Kích thước</h3>
                                    <div className="flex flex-wrap gap-3">
                                        {variants.map((variant, index) => (
                                            <button
                                                key={variant.id}
                                                onClick={() => handleVariantChange(index)}
                                                className={`px-4 py-3 rounded-xl border transition-all ${selectedVariant === index
                                                    ? 'bg-white text-black border-white'
                                                    : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-color)] hover:border-white/40'
                                                    }`}
                                            >
                                                <span className="block text-sm font-medium">{variant.name}</span>
                                                <span className="block text-xs opacity-70">
                                                    {variant.price.toLocaleString('vi-VN')}đ
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
                                <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Số lượng</h3>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="w-12 h-12 rounded-xl bg-[var(--material-glass)] text-[var(--text-primary)] flex items-center justify-center hover:bg-[var(--material-glass)]"
                                    >
                                        -
                                    </button>
                                    <span className="text-xl font-semibold text-[var(--text-primary)] w-12 text-center">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(quantity + 1)}
                                        className="w-12 h-12 rounded-xl bg-[var(--material-glass)] text-[var(--text-primary)] flex items-center justify-center hover:bg-[var(--material-glass)]"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </AnimatedSection>

                        {/* Action Buttons */}
                        <AnimatedSection delay={0.5}>
                            <div className="flex flex-col gap-3">
                                {/* Primary: Add to Cart */}
                                <button
                                    onClick={handleAddToCart}
                                    className={`w-full rounded-xl px-6 py-4 font-semibold transition-all cursor-pointer ${addedToCart
                                        ? 'bg-white text-black'
                                        : 'bg-white text-black hover:bg-white/90'
                                        }`}
                                >
                                    {addedToCart ? '✓ Đã thêm vào giỏ' : 'Thêm vào giỏ hàng'}
                                </button>

                                {/* Secondary row: Buy Now + View Cart */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleBuyNow}
                                        className="flex-1 rounded-xl bg-white px-6 py-4 font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.99] cursor-pointer"
                                    >
                                        Thanh toán ngay
                                    </button>
                                    <Link
                                        href="/cart"
                                        className="px-6 py-4 rounded-xl border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--material-glass)] flex items-center justify-center"
                                    >
                                        Xem giỏ
                                    </Link>
                                </div>
                            </div>
                        </AnimatedSection>

                        {/* Product Details */}
                        <AnimatedSection delay={0.6}>
                            <div className="mt-12 pt-8 border-t border-[var(--border-color)]">
                                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Chi tiết sản phẩm</h3>
                                <div className="prose prose-invert max-w-none">
                                    <p className="text-[var(--text-secondary)]">{product.description}</p>
                                </div>
                                <ul className="mt-4 space-y-2">
                                    <li className="flex items-center gap-2 text-[var(--text-secondary)]">
                                        <span className="w-2 h-2 rounded-full bg-green-400" />
                                        SKU: {currentVariant?.sku || product.sku}
                                    </li>
                                    <li className="flex items-center gap-2 text-[var(--text-secondary)]">
                                        <span className="w-2 h-2 rounded-full bg-green-400" />
                                        Còn hàng: {
                                            currentVariant
                                                ? currentVariant.stock
                                                : product.stock
                                        } sản phẩm
                                    </li>
                                    {currentVariant && (
                                        <li className="flex items-center gap-2 text-[var(--text-secondary)]">
                                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                                            Size: {currentVariant.name}
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </AnimatedSection>
                    </div>
                </div>
            </div>
        </div>
    );
}
