'use client';

import { useState, useEffect, useCallback } from 'react';

interface WishlistItem {
    id: string;
    created_at: string;
    product: {
        id: string;
        name: string;
        slug: string;
        sku: string;
        base_price: number;
        sale_price: number | null;
        images: Array<{ url: string }>;
        status: string;
    };
}

interface UseWishlistReturn {
    wishlist: WishlistItem[];
    isLoading: boolean;
    isInWishlist: (productId: string) => boolean;
    addToWishlist: (productId: string) => Promise<boolean>;
    removeFromWishlist: (productId: string) => Promise<boolean>;
    toggleWishlist: (productId: string) => Promise<boolean>;
    refresh: () => Promise<void>;
    count: number;
}

/**
 * Custom hook for managing wishlist
 */
export function useWishlist(): UseWishlistReturn {
    const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [productIds, setProductIds] = useState<Set<string>>(new Set());

    // Fetch wishlist
    const fetchWishlist = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/wishlist');

            if (!res.ok) {
                if (res.status === 401) {
                    // User not logged in
                    setWishlist([]);
                    setProductIds(new Set());
                    return;
                }
                throw new Error('Failed to fetch wishlist');
            }

            const data = await res.json();
            setWishlist(data.wishlist || []);
            setProductIds(new Set(data.wishlist?.map((item: WishlistItem) => item.product.id) || []));
        } catch (error) {
            console.error('[useWishlist] Error:', error);
            setWishlist([]);
            setProductIds(new Set());
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWishlist();
    }, [fetchWishlist]);

    // Check if product is in wishlist
    const isInWishlist = useCallback((productId: string): boolean => {
        return productIds.has(productId);
    }, [productIds]);

    // Add to wishlist
    const addToWishlist = useCallback(async (productId: string): Promise<boolean> => {
        try {
            const res = await fetch('/api/wishlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId }),
            });

            if (!res.ok) {
                throw new Error('Failed to add to wishlist');
            }

            // Optimistic update
            setProductIds(prev => new Set([...prev, productId]));
            await fetchWishlist(); // Refresh full list
            return true;
        } catch (error) {
            console.error('[useWishlist] Add error:', error);
            return false;
        }
    }, [fetchWishlist]);

    // Remove from wishlist
    const removeFromWishlist = useCallback(async (productId: string): Promise<boolean> => {
        try {
            const res = await fetch('/api/wishlist', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId }),
            });

            if (!res.ok) {
                throw new Error('Failed to remove from wishlist');
            }

            // Optimistic update
            setProductIds(prev => {
                const next = new Set(prev);
                next.delete(productId);
                return next;
            });
            setWishlist(prev => prev.filter(item => item.product.id !== productId));
            return true;
        } catch (error) {
            console.error('[useWishlist] Remove error:', error);
            return false;
        }
    }, []);

    // Toggle wishlist
    const toggleWishlist = useCallback(async (productId: string): Promise<boolean> => {
        if (isInWishlist(productId)) {
            return removeFromWishlist(productId);
        } else {
            return addToWishlist(productId);
        }
    }, [isInWishlist, addToWishlist, removeFromWishlist]);

    return {
        wishlist,
        isLoading,
        isInWishlist,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        refresh: fetchWishlist,
        count: wishlist.length,
    };
}
