'use client';

/**
 * GlassCard Component
 * 
 * Modern glassmorphism card with hover effects and glow.
 * Follows ui-ux-pro-max glassmorphism guidelines.
 */

import { type ReactNode, type HTMLAttributes } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';

// =============================================================================
// Types
// =============================================================================

type GlassVariant = 'default' | 'subtle' | 'dark' | 'light' | 'glow';
type GlassSize = 'sm' | 'md' | 'lg' | 'xl';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
    children: ReactNode;
    variant?: GlassVariant;
    size?: GlassSize;
    hoverable?: boolean;
    glowColor?: 'primary' | 'accent' | 'white' | 'none';
    className?: string;
}

// =============================================================================
// Variant Config
// =============================================================================

const variantConfig = {
    default: {
        bg: 'bg-[rgba(29,29,31,0.9)]',
        backdrop: 'backdrop-blur-xl',
        border: 'border-white/10',
    },
    subtle: {
        bg: 'bg-[rgba(255,255,255,0.03)]',
        backdrop: 'backdrop-blur-md',
        border: 'border-white/5',
    },
    dark: {
        bg: 'bg-[rgba(10,10,10,0.95)]',
        backdrop: 'backdrop-blur-xl',
        border: 'border-white/8',
    },
    light: {
        bg: 'bg-[rgba(255,255,255,0.85)]',
        backdrop: 'backdrop-blur-xl',
        border: 'border-black/5',
    },
    glow: {
        bg: 'bg-[rgba(29,29,31,0.8)]',
        backdrop: 'backdrop-blur-xl',
        border: 'border-[#0071E3]/30',
    },
};

const sizeConfig = {
    sm: 'p-4 rounded-xl',
    md: 'p-6 rounded-2xl',
    lg: 'p-8 rounded-2xl',
    xl: 'p-10 rounded-3xl',
};

const glowConfig = {
    primary: 'shadow-[0_0_30px_rgba(0,113,227,0.15)]',
    accent: 'shadow-[0_0_30px_rgba(139,92,246,0.15)]',
    white: 'shadow-[0_0_30px_rgba(255,255,255,0.05)]',
    none: '',
};

// =============================================================================
// GlassCard Component
// =============================================================================

export function GlassCard({
    children,
    variant = 'default',
    size = 'md',
    hoverable = true,
    glowColor = 'none',
    className,
    ...props
}: GlassCardProps) {
    const vConfig = variantConfig[variant];

    return (
        <motion.div
            whileHover={hoverable ? { scale: 1.02, y: -4 } : undefined}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className={clsx(
                'relative overflow-hidden border transition-shadow duration-300',
                vConfig.bg,
                vConfig.backdrop,
                vConfig.border,
                sizeConfig[size],
                glowConfig[glowColor],
                hoverable && 'hover:shadow-lg hover:border-white/20',
                className
            )}
            {...props}
        >
            {/* Gradient overlay on hover */}
            {hoverable && (
                <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-transparent to-white/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
            )}

            {/* Content */}
            <div className="relative z-10">{children}</div>
        </motion.div>
    );
}

// =============================================================================
// Glass Card Parts
// =============================================================================

export function GlassCardHeader({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={clsx('mb-4', className)}>
            {children}
        </div>
    );
}

export function GlassCardTitle({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <h3 className={clsx('text-xl font-semibold text-white', className)}>
            {children}
        </h3>
    );
}

export function GlassCardDescription({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <p className={clsx('mt-1 text-sm text-white/60', className)}>
            {children}
        </p>
    );
}

export function GlassCardContent({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return <div className={clsx('', className)}>{children}</div>;
}

export function GlassCardFooter({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={clsx('mt-6 flex items-center justify-between', className)}>
            {children}
        </div>
    );
}

// =============================================================================
// Stat Card - Common pattern for dashboards
// =============================================================================

interface StatCardProps {
    title: string;
    value: string | number;
    change?: {
        value: number;
        type: 'increase' | 'decrease' | 'neutral';
    };
    icon?: ReactNode;
    className?: string;
}

export function StatCard({
    title,
    value,
    change,
    icon,
    className,
}: StatCardProps) {
    return (
        <GlassCard size="md" glowColor="none" className={className}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-white/60">{title}</p>
                    <p className="mt-2 text-3xl font-bold text-white">{value}</p>
                    {change && (
                        <p
                            className={clsx(
                                'mt-2 text-sm font-medium flex items-center gap-1',
                                change.type === 'increase' && 'text-green-500',
                                change.type === 'decrease' && 'text-red-500',
                                change.type === 'neutral' && 'text-white/40'
                            )}
                        >
                            {change.type === 'increase' && '↑'}
                            {change.type === 'decrease' && '↓'}
                            {change.value}%
                        </p>
                    )}
                </div>
                {icon && (
                    <div className="p-3 rounded-xl bg-white/5">
                        {icon}
                    </div>
                )}
            </div>
        </GlassCard>
    );
}

export default GlassCard;
