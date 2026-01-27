'use client';

/**
 * Progress Component
 * 
 * Linear progress bar with multiple variants.
 * Supports determinate and indeterminate states.
 */

import { motion } from 'framer-motion';
import { clsx } from 'clsx';

// =============================================================================
// Types
// =============================================================================

interface ProgressProps {
    value?: number;
    max?: number;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'success' | 'warning' | 'error';
    indeterminate?: boolean;
    showValue?: boolean;
    className?: string;
}

// =============================================================================
// Size Config
// =============================================================================

const sizeConfig = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
};

const variantConfig = {
    default: 'bg-[#0071E3]',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
};

// =============================================================================
// Progress Component
// =============================================================================

export function Progress({
    value = 0,
    max = 100,
    size = 'md',
    variant = 'default',
    indeterminate = false,
    showValue = false,
    className,
}: ProgressProps) {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
        <div className={clsx('w-full', className)}>
            <div
                role="progressbar"
                aria-valuenow={indeterminate ? undefined : value}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-label={`Progress: ${percentage.toFixed(0)}%`}
                className={clsx(
                    'relative w-full overflow-hidden rounded-full bg-white/10',
                    sizeConfig[size]
                )}
            >
                {indeterminate ? (
                    <motion.div
                        className={clsx('absolute inset-y-0 w-1/3 rounded-full', variantConfig[variant])}
                        animate={{
                            x: ['-100%', '400%'],
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    />
                ) : (
                    <motion.div
                        className={clsx('h-full rounded-full', variantConfig[variant])}
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                )}
            </div>
            {showValue && !indeterminate && (
                <div className="mt-1 text-right">
                    <span className="text-xs text-white/60">{percentage.toFixed(0)}%</span>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Circular Progress
// =============================================================================

interface CircularProgressProps {
    value?: number;
    size?: number;
    strokeWidth?: number;
    variant?: 'default' | 'success' | 'warning' | 'error';
    indeterminate?: boolean;
    showValue?: boolean;
    className?: string;
}

const circularVariantConfig = {
    default: 'stroke-[#0071E3]',
    success: 'stroke-green-500',
    warning: 'stroke-yellow-500',
    error: 'stroke-red-500',
};

export function CircularProgress({
    value = 0,
    size = 48,
    strokeWidth = 4,
    variant = 'default',
    indeterminate = false,
    showValue = false,
    className,
}: CircularProgressProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const percentage = Math.min(Math.max(value, 0), 100);
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div
            className={clsx('relative inline-flex items-center justify-center', className)}
            style={{ width: size, height: size }}
            role="progressbar"
            aria-valuenow={indeterminate ? undefined : value}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <svg
                className={clsx(indeterminate && 'animate-spin')}
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
            >
                {/* Background track */}
                <circle
                    className="stroke-white/10"
                    fill="none"
                    strokeWidth={strokeWidth}
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                {/* Progress */}
                <motion.circle
                    className={circularVariantConfig[variant]}
                    fill="none"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{
                        strokeDashoffset: indeterminate ? circumference * 0.75 : offset,
                    }}
                    style={{
                        strokeDasharray: circumference,
                        transform: 'rotate(-90deg)',
                        transformOrigin: '50% 50%',
                    }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                />
            </svg>
            {showValue && !indeterminate && (
                <span className="absolute text-xs font-medium text-white">
                    {percentage.toFixed(0)}%
                </span>
            )}
        </div>
    );
}

export default Progress;
