'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useWishlist } from '@/lib/hooks/useWishlist';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';

/**
 * Wishlist Page - User's saved products
 */
export default function WishlistPage() {
    const { wishlist, isLoading, removeFromWishlist } = useWishlist();
    const [removingId, setRemovingId] = useState<string | null>(null);

    const handleRemove = async (productId: string) => {
        setRemovingId(productId);
        await removeFromWishlist(productId);
        setRemovingId(null);
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] pt-24 pb-16">
            <div className="max-w-6xl mx-auto px-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
                        Danh sách yêu thích
                    </h1>
                    <p className="text-[var(--text-secondary)]">
                        {isLoading ? 'Đang tải...' : `${wishlist.length} sản phẩm`}
                    </p>
                </div>

                {/* Loading State */}
                {isLoading && <ProductGridSkeleton count={4} />}

                {/* Empty State */}
                {!isLoading && wishlist.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-16"
                    >
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
                            <svg className="w-10 h-10 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                            Chưa có sản phẩm yêu thích
                        </h2>
                        <p className="text-[var(--text-secondary)] mb-6">
                            Hãy thêm sản phẩm vào danh sách yêu thích để xem lại sau
                        </p>
                        <Link
                            href="/products"
                            className="inline-block px-6 py-3 bg-[var(--color-accent)] text-white rounded-full font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
                        >
                            Khám phá sản phẩm
                        </Link>
                    </motion.div>
                )}

                {/* Wishlist Grid */}
                {!isLoading && wishlist.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        <AnimatePresence mode="popLayout">
                            {wishlist.map((item) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] overflow-hidden group"
                                >
                                    {/* Product Image */}
                                    <Link href={`/products/${item.product.id}`}>
                                        <div className="aspect-square relative bg-[var(--bg-secondary)]">
                                            {item.product.images?.[0]?.url ? (
                                                <img
                                                    src={item.product.images[0].url}
                                                    alt={item.product.name}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <svg className="w-12 h-12 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </Link>

                                    {/* Product Info */}
                                    <div className="p-4">
                                        <Link href={`/products/${item.product.id}`}>
                                            <h3 className="font-medium text-[var(--text-primary)] line-clamp-2 hover:text-[var(--color-accent)] transition-colors">
                                                {item.product.name}
                                            </h3>
                                        </Link>
                                        <p className="text-sm text-[var(--text-tertiary)] mt-1">
                                            {item.product.sku}
                                        </p>

                                        {/* Price */}
                                        <div className="mt-2">
                                            {item.product.sale_price ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-[var(--text-primary)]">
                                                        {Number(item.product.sale_price).toLocaleString('vi-VN')}đ
                                                    </span>
                                                    <span className="text-sm text-[var(--text-tertiary)] line-through">
                                                        {Number(item.product.base_price).toLocaleString('vi-VN')}đ
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="font-semibold text-[var(--text-primary)]">
                                                    {Number(item.product.base_price).toLocaleString('vi-VN')}đ
                                                </span>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2 mt-4">
                                            <Link
                                                href={`/products/${item.product.id}`}
                                                className="flex-1 py-2 bg-[var(--color-accent)] text-white text-center rounded-lg text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
                                            >
                                                Xem chi tiết
                                            </Link>
                                            <button
                                                onClick={() => handleRemove(item.product.id)}
                                                disabled={removingId === item.product.id}
                                                className="px-3 py-2 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-50"
                                                title="Xóa khỏi yêu thích"
                                            >
                                                {removingId === item.product.id ? (
                                                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
