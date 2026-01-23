'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWishlist } from '@/lib/hooks/useWishlist';

interface WishlistButtonProps {
    productId: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

/**
 * Heart button to toggle product in wishlist
 */
export function WishlistButton({ productId, size = 'md', className = '' }: WishlistButtonProps) {
    const { isInWishlist, toggleWishlist } = useWishlist();
    const [isLoading, setIsLoading] = useState(false);
    const isActive = isInWishlist(productId);

    const sizes = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12',
    };

    const iconSizes = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6',
    };

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setIsLoading(true);
        await toggleWishlist(productId);
        setIsLoading(false);
    };

    return (
        <motion.button
            onClick={handleClick}
            disabled={isLoading}
            whileTap={{ scale: 0.9 }}
            className={`
                ${sizes[size]} 
                rounded-full flex items-center justify-center
                bg-black/20 backdrop-blur-sm border border-white/10
                hover:bg-black/40 transition-colors
                disabled:cursor-wait
                ${className}
            `}
            title={isActive ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}
        >
            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`${iconSizes[size]} border-2 border-white/30 border-t-white rounded-full animate-spin`}
                    />
                ) : (
                    <motion.svg
                        key={isActive ? 'filled' : 'empty'}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className={`${iconSizes[size]} ${isActive ? 'text-red-500' : 'text-white'}`}
                        fill={isActive ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                    </motion.svg>
                )}
            </AnimatePresence>
        </motion.button>
    );
}
