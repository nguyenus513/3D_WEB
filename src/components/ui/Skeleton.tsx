'use client';

import { motion, type Easing } from 'framer-motion';

/**
 * Skeleton Loading Components
 * Apple-style shimmer effect for loading states
 */

// Shimmer animation config
const shimmerTransition = {
    duration: 1.5,
    repeat: Infinity,
    ease: 'linear' as Easing,
};

interface SkeletonProps {
    className?: string;
}

/**
 * Base Skeleton with shimmer effect
 */
export function Skeleton({ className = '' }: SkeletonProps) {
    return (
        <motion.div
            className={`bg-[var(--bg-secondary)] rounded-lg relative overflow-hidden ${className}`}
            animate={{
                backgroundPosition: ['200% 0', '-200% 0'],
            }}
            transition={shimmerTransition}
            style={{
                backgroundImage:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
            }}
        />
    );
}

/**
 * Skeleton for Product Card
 */
export function ProductCardSkeleton() {
    return (
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] overflow-hidden">
            {/* Image skeleton */}
            <Skeleton className="aspect-square w-full" />

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Category */}
                <Skeleton className="h-3 w-16" />

                {/* Title */}
                <Skeleton className="h-5 w-3/4" />

                {/* Price */}
                <Skeleton className="h-6 w-24" />
            </div>
        </div>
    );
}

/**
 * Skeleton for Product Grid
 */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <ProductCardSkeleton key={i} />
            ))}
        </div>
    );
}

/**
 * Skeleton for Order Card
 */
export function OrderCardSkeleton() {
    return (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] p-5">
            <div className="flex justify-between items-start mb-4">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
            </div>

            <div className="flex gap-4 mb-4">
                <Skeleton className="w-16 h-16 rounded-lg" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-[var(--card-border)]">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-9 w-24 rounded-full" />
            </div>
        </div>
    );
}

/**
 * Skeleton for Table Row
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
    return (
        <tr className="border-b border-[var(--card-border)]">
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="py-4 px-4">
                    <Skeleton className="h-4 w-full" />
                </td>
            ))}
        </tr>
    );
}

/**
 * Skeleton for Full Page Loading
 */
export function PageSkeleton() {
    return (
        <div className="min-h-screen bg-[var(--bg-primary)] pt-20">
            <div className="container">
                {/* Header */}
                <div className="mb-8 space-y-4">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-5 w-96" />
                </div>

                {/* Content */}
                <ProductGridSkeleton count={6} />
            </div>
        </div>
    );
}

/**
 * Skeleton for Form
 */
export function FormSkeleton() {
    return (
        <div className="space-y-6">
            {/* Form fields */}
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24 w-full rounded-xl" />
            </div>

            {/* Button */}
            <Skeleton className="h-12 w-full rounded-full" />
        </div>
    );
}

/**
 * Skeleton for Profile Card
 */
export function ProfileSkeleton() {
    return (
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-6">
            <div className="flex items-center gap-4 mb-6">
                <Skeleton className="w-16 h-16 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                </div>
            </div>

            <div className="space-y-4">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
            </div>
        </div>
    );
}

/**
 * Spinner Loading
 */
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const sizes = {
        sm: 'w-4 h-4 border',
        md: 'w-8 h-8 border-2',
        lg: 'w-12 h-12 border-2',
    };

    return (
        <div
            className={`${sizes[size]} border-[var(--color-accent)] border-t-transparent rounded-full animate-spin`}
        />
    );
}

/**
 * Loading Overlay
 */
export function LoadingOverlay({ message = 'Đang tải...' }: { message?: string }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[var(--bg-primary)]/80 backdrop-blur-sm flex items-center justify-center z-50"
        >
            <div className="flex flex-col items-center gap-4">
                <Spinner size="lg" />
                <span className="text-[var(--text-secondary)] text-sm">{message}</span>
            </div>
        </motion.div>
    );
}
