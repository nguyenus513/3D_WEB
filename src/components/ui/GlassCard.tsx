'use client';

/**
 * GlassCard Component (Legacy Wrapper -> Upgraded to Spatial)
 * 
 * This component now wraps the high-fidelity SpatialCard to ensure
 * immediate system-wide upgrade without refactoring every import.
 * 
 * It maps the old 'variant' props to new Spatial 'depth' and 'variant' settings.
 */

import { type ReactNode } from 'react';
import { type HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';
import { SpatialCard } from './SpatialCard';

// =============================================================================
// Types (Kept for compatibility)
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
// Adapter Logic
// =============================================================================

const sizeStyles = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
};

// Map legacy variants to new Spatial props
function getSpatialProps(variant: GlassVariant): { variant: 'panel' | 'glass' | 'overlay', depth: 'level-1' | 'level-2' | 'level-3' } {
    switch (variant) {
        case 'default': return { variant: 'panel', depth: 'level-1' };
        case 'subtle': return { variant: 'glass', depth: 'level-1' };
        case 'dark': return { variant: 'panel', depth: 'level-2' }; // Dark/Heavy -> Panel L2
        case 'light': return { variant: 'overlay', depth: 'level-2' }; // Light/Floaty -> Overlay L2
        case 'glow': return { variant: 'glass', depth: 'level-3' }; // Glow -> High float
        default: return { variant: 'panel', depth: 'level-1' };
    }
}

// =============================================================================
// Component
// =============================================================================

export function GlassCard({
    children,
    variant = 'default',
    size = 'md',
    hoverable = true,
    glowColor = 'none', // Deprecated in Spatial but kept for type safety
    className,
    ...props
}: GlassCardProps) {
    const { variant: spatialVariant, depth } = getSpatialProps(variant);

    return (
        <SpatialCard
            variant={spatialVariant}
            depth={depth}
            hoverable={hoverable}
            className={clsx(sizeStyles[size], className)}
            {...props}
        >
            {children}
        </SpatialCard>
    );
}

// =============================================================================
// Parts (Composed)
// =============================================================================

export function GlassCardHeader({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={clsx('mb-4', className)}>{children}</div>;
}

export function GlassCardTitle({ children, className }: { children: ReactNode; className?: string }) {
    return <h3 className={clsx('text-xl font-bold text-[var(--text-primary)]', className)}>{children}</h3>;
}

export function GlassCardDescription({ children, className }: { children: ReactNode; className?: string }) {
    return <p className={clsx('mt-1 text-sm text-[var(--text-secondary)]', className)}>{children}</p>;
}

export function GlassCardContent({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={className}>{children}</div>;
}

export function GlassCardFooter({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={clsx('mt-6 flex items-center justify-between', className)}>{children}</div>;
}

// =============================================================================
// Stat Card Adapter
// =============================================================================

interface StatCardProps {
    title: string;
    value: string | number;
    change?: { value: number; type: 'increase' | 'decrease' | 'neutral' };
    icon?: ReactNode;
    className?: string;
}

export function StatCard({ title, value, change, icon, className }: StatCardProps) {
    return (
        <GlassCard size="md" className={className}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-[var(--text-secondary)]">{title}</p>
                    <p className="mt-2 text-3xl font-bold text-[var(--text-primary)] tracking-tight">{value}</p>
                    {change && (
                        <p className={clsx(
                            'mt-2 text-sm font-semibold flex items-center gap-1',
                            change.type === 'increase' && 'text-[var(--color-success)]',
                            change.type === 'decrease' && 'text-[var(--color-error)]',
                            change.type === 'neutral' && 'text-[var(--text-tertiary)]'
                        )}>
                            {change.type === 'increase' && '↑'}
                            {change.type === 'decrease' && '↓'}
                            {change.value}%
                        </p>
                    )}
                </div>
                {icon && (
                    <div className="p-3 rounded-2xl bg-[var(--material-glass)] text-[var(--color-accent)] shadow-sm border border-white/20">
                        {icon}
                    </div>
                )}
            </div>
        </GlassCard>
    );
}

export default GlassCard;
