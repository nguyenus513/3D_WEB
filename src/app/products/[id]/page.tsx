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
    const [selectedImage, setSelectedImage] = useState(0); // Current image within size
    const [quantity, setQuantity] = useState(1);
    const [addedToCart, setAddedToCart] = useState(false);
    const [payingNow, setPayingNow] = useState(false);

    const addItem = useCartStore(state => state.addItem);

    // Get product's general images
    const getProductImages = (): string[] => {
        if (!product) return [];
        return (product.images || []).map(img =>
            typeof img === 'string' ? img : img.url
        );
    };

    // Get current size's images combined with product images
    const getCurrentImages = (): string[] => {
        if (!product) return [];

        const productImages = getProductImages();
        const size = product.sizes?.[selectedSize] as any;

        // Get size-specific images
        let sizeImages: string[] = [];
        if (size?.images && size.images.length > 0) {
            sizeImages = size.images;
        } else if (size?.image_url) {
            sizeImages = [size.image_url];
        }

        // Combine: size images FIRST, then product images (no duplicates)
        const combined = [...sizeImages];
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

    // Reset selected image when size changes
    const handleSizeChange = (index: number) => {
        setSelectedSize(index);
        setSelectedImage(0); // Reset to first image of new size
    };

    // Handle direct payment (Pay Now) with retry logic
    const handlePayNow = async () => {
        if (!product || payingNow) return;

        setPayingNow(true);
        const idempotencyKey = crypto.randomUUID();
        let retryCount = 0;
        const maxRetries = 3;

        try {
            const size = product.sizes?.[selectedSize];
            const price = size?.price || product.sale_price || product.base_price;

            const attemptPayment = async (): Promise<{ success: boolean; data?: any; error?: any }> => {
                const res = await fetch('/api/payments/direct', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': idempotencyKey,
                    },
                    body: JSON.stringify({
                        productId: product.id,
                        productName: product.name,
                        productType: 'product',
                        quantity,
                        unitPrice: price,
                        metadata: {
                            size: size?.name || 'Default',
                            sku: product.sku,
                            image: typeof product.images?.[0] === 'string' ? product.images[0] : product.images?.[0]?.url, // Handle both formats
                        },
                    }),
                });

                return res.json();
            };

            // Retry logic with exponential backoff
            let result = await attemptPayment();

            while (!result.success && retryCount < maxRetries) {
                retryCount++;
                const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
                console.log(`Payment retry ${retryCount}/${maxRetries} in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                result = await attemptPayment();
            }

            if (!result.success) {
                const errorMsg = result.error?.message || 'Không thể tạo đơn hàng. Vui lòng thử lại sau.';
                alert(`${errorMsg}\n\nMã lỗi: ${result.error?.details?.correlationId || 'N/A'}`);
                return;
            }

            // Navigate to QR page with the child code
            router.push(`/qr/child/${result.data.codeChild}`);
        } catch (error) {
            console.error('PayNow error:', error);
            alert('Có lỗi xảy ra, vui lòng thử lại');
        } finally {
            setPayingNow(false);
        }
    };

    useEffect(() => {
        fetchProduct();
    }, [productId]);

    const fetchProduct = async () => {
        const supabase = getSupabase();

        // Try to fetch by ID (UUID) or slug
        let query = supabase.from('products').select('*');

        // Check if it's a UUID
        if (productId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            query = query.eq('id', productId);
        } else {
            // Try by ID as fallback (slug removed)
            query = query.eq('id', productId);
        }

        const { data, error } = await query.single();

        if (error || !data) {
            setLoading(false);
            return;
        }

        // Schema v3 Adapter: Map DB fields to Component expectations
        const adaptedProduct: Product = {
            ...data,
            // Use sizes from top-level column (not specs.sizes)
            sizes: (data.sizes || []).map((s: any) => ({
                ...s,
                enabled: s.enabled !== false // Default to enabled if missing
            })),
            // Ensure images is string[] but component might check .url, need to inspect component usage
            // The component uses product.images[0].url checks, so we might need object wrapping if we don't change component logic
            // But let's verify if we can just update component logic.
            // For now, let's cast/map strictly.
        };

        // Images handling: New schema is string[]. Component expects { url: string }[] logic? 
        // Actually component lines 185: product.images?.[0]?.url 
        // We should probably patch the component to handle string[] or map it here.
        // Let's map it here for minimal component disruption:
        const imagesAdapted = (data.images || []).map((img: string | { url: string }) =>
            typeof img === 'string' ? { url: img } : img
        );

        setProduct({ ...adaptedProduct, images: imagesAdapted as any });
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
            sku: product.sku || undefined,
            price: price,
            quantity: quantity,
            size: size?.name || 'Default',
            image: typeof product.images?.[0] === 'string' ? product.images[0] : product.images?.[0]?.url,
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
                    {/* Left - Product Gallery (based on selected size) */}
                    <AnimatedSection animation="fadeIn">
                        <div className="space-y-4">
                            {/* Main Image */}
                            <div className="aspect-square rounded-3xl bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center relative overflow-hidden">
                                {getCurrentImages()[selectedImage] ? (
                                    <motion.img
                                        key={`${selectedSize}-${selectedImage}`}
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
                                    <div className="absolute top-4 left-4 px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-full">
                                        SALE
                                    </div>
                                )}

                                {/* Navigation Arrows */}
                                {getCurrentImages().length > 1 && (
                                    <>
                                        <button
                                            onClick={handlePrevImage}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
                                            aria-label="Previous image"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={handleNextImage}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
                                            aria-label="Next image"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                        {/* Image counter */}
                                        <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/50 rounded-full text-white text-xs">
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
                                                : 'border-white/20 hover:border-white/50'
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

                            {/* Current size label */}
                            {product.sizes && product.sizes.length > 0 && (
                                <p className="text-sm text-white/50 text-center">
                                    Đang xem: <span className="text-white font-medium">{product.sizes[selectedSize]?.name}</span>
                                </p>
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
                                        {product.sizes.map((size, index) => (
                                            size.enabled !== false && (
                                                <button
                                                    key={size.name}
                                                    onClick={() => handleSizeChange(index)}
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
                                            )
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

                        {/* Action Buttons */}
                        <AnimatedSection delay={0.5}>
                            <div className="flex flex-col gap-3">
                                {/* Primary: Add to Cart */}
                                <button
                                    onClick={handleAddToCart}
                                    className={`w-full py-4 rounded-xl font-semibold transition-all cursor-pointer ${addedToCart
                                        ? 'bg-green-500 text-white'
                                        : 'bg-white text-black hover:bg-white/90'
                                        }`}
                                >
                                    {addedToCart ? '✓ Đã thêm vào giỏ' : 'Thêm vào giỏ hàng'}
                                </button>

                                {/* Secondary row: Pay Now + View Cart */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={handlePayNow}
                                        disabled={payingNow}
                                        className="flex-1 py-4 rounded-xl font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        {payingNow ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Đang xử lý...
                                            </span>
                                        ) : 'Thanh toán ngay'}
                                    </button>
                                    <Link
                                        href="/cart"
                                        className="px-6 py-4 rounded-xl border border-white/20 text-white hover:bg-white/10 flex items-center justify-center"
                                    >
                                        Xem giỏ
                                    </Link>
                                </div>
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
                                        SKU: {product.sizes && product.sizes.length > 0 && product.sizes[selectedSize]?.sku
                                            ? product.sizes[selectedSize].sku
                                            : product.sku}
                                    </li>
                                    <li className="flex items-center gap-2 text-white/60">
                                        <span className="w-2 h-2 rounded-full bg-green-400" />
                                        Còn hàng: {
                                            product.sizes && product.sizes.length > 0
                                                ? (product.sizes[selectedSize]?.stock ?? product.sizes.reduce((sum, s) => sum + (s.stock || 0), 0))
                                                : product.stock
                                        } sản phẩm
                                    </li>
                                    {product.sizes && product.sizes.length > 0 && product.sizes[selectedSize] && (
                                        <li className="flex items-center gap-2 text-white/60">
                                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                                            Size: {product.sizes[selectedSize].name}
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
