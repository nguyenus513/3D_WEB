'use client';

/**
 * SpatialCard Component
 * 
 * Core building block of the Visionary Spatial system.
 * Features:
 * - Adaptive Material (Glass/Panel)
 * - Caustic Border Lighting
 * - Spatial Shadow Depth
 * - Fluid Hover Physics
 */

import { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';
import { useJellyMotion } from '@/lib/jelly';

// =============================================================================
// Types
// =============================================================================

type SpatialVariant = 'panel' | 'glass' | 'overlay';
type SpatialDepth = 'level-1' | 'level-2' | 'level-3';

interface SpatialCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
    children: ReactNode;
    variant?: SpatialVariant;
    depth?: SpatialDepth;
    hoverable?: boolean;
    jelly?: boolean;
    className?: string;
}

// =============================================================================
// Configurations
// =============================================================================

const variantStyles = {
    panel: {
        background: 'var(--material-panel)',
        backdropFilter: 'blur(var(--blur-panel)) saturate(var(--saturate-panel))',
    },
    glass: {
        background: 'var(--material-glass)',
        backdropFilter: 'blur(var(--blur-glass))',
    },
    overlay: {
        background: 'var(--material-overlay)',
        backdropFilter: 'blur(var(--blur-overlay))',
    }
};

const depthShadows = {
    'level-1': 'var(--shadow-1)',
    'level-2': 'var(--shadow-2)',
    'level-3': 'var(--shadow-3)',
};

// =============================================================================
// Component
// =============================================================================

export function SpatialCard({
    children,
    variant = 'panel',
    depth = 'level-1',
    hoverable = true,
    jelly = true,
    className,
    style,
    ...props
}: SpatialCardProps) {
    const jellyMotion = useJellyMotion({
        disabled: !hoverable || !jelly,
        hoverScale: 1.02,
        tapScale: 0.99,
        hoverY: -4,
        stiffness: 180,
        damping: 22,
    });

    const hoverMotion = hoverable
        ? { ...(jellyMotion.whileHover || {}), boxShadow: 'var(--shadow-2)' }
        : undefined;

    return (
        <motion.div
            initial={false}
            whileHover={hoverMotion}
            whileTap={jellyMotion.whileTap}
            transition={jellyMotion.transition || {
                type: 'spring',
                mass: 1,
                stiffness: 140,
                damping: 20,
            }}
            style={{
                ...variantStyles[variant],
                boxShadow: depthShadows[depth],
                border: 'var(--border-spatial)',
                borderTop: '1px solid var(--edge-light)',
                borderBottom: '1px solid var(--edge-shade)',
                ...style
            }}
            className={clsx(
                'rounded-3xl relative overflow-hidden transition-colors',
                jelly && 'jelly-interactive',
                className
            )}
            {...props}
        >
            {/* Caustic Light Overlay (Shimmer) */}
            {hoverable && (
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            )}

            {children}
        </motion.div>
    );
}
