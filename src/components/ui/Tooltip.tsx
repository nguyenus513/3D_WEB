'use client';

/**
 * Tooltip Component
 * 
 * Accessible tooltip with smart positioning.
 * Follows WAI-ARIA tooltip pattern.
 */

import { useState, useRef, type ReactNode, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

// =============================================================================
// Types
// =============================================================================

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
    content: ReactNode;
    children: ReactElement;
    position?: TooltipPosition;
    delay?: number;
    className?: string;
}

// =============================================================================
// Position Styles
// =============================================================================

const positionStyles = {
    top: {
        container: '-top-2 left-1/2 -translate-x-1/2 -translate-y-full',
        arrow: 'top-full left-1/2 -translate-x-1/2 border-t-[#1D1D1F] border-x-transparent border-b-transparent',
        initial: { opacity: 0, y: 5 },
        animate: { opacity: 1, y: 0 },
    },
    bottom: {
        container: '-bottom-2 left-1/2 -translate-x-1/2 translate-y-full',
        arrow: 'bottom-full left-1/2 -translate-x-1/2 border-b-[#1D1D1F] border-x-transparent border-t-transparent',
        initial: { opacity: 0, y: -5 },
        animate: { opacity: 1, y: 0 },
    },
    left: {
        container: 'top-1/2 -left-2 -translate-x-full -translate-y-1/2',
        arrow: 'left-full top-1/2 -translate-y-1/2 border-l-[#1D1D1F] border-y-transparent border-r-transparent',
        initial: { opacity: 0, x: 5 },
        animate: { opacity: 1, x: 0 },
    },
    right: {
        container: 'top-1/2 -right-2 translate-x-full -translate-y-1/2',
        arrow: 'right-full top-1/2 -translate-y-1/2 border-r-[#1D1D1F] border-y-transparent border-l-transparent',
        initial: { opacity: 0, x: -5 },
        animate: { opacity: 1, x: 0 },
    },
};

// =============================================================================
// Tooltip Component
// =============================================================================

export function Tooltip({
    content,
    children,
    position = 'top',
    delay = 200,
    className,
}: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const tooltipId = useRef(`tooltip-${crypto.randomUUID()}`);

    const styles = positionStyles[position];

    const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsVisible(false);
    };

    const handleFocus = () => {
        setIsVisible(true);
    };

    const handleBlur = () => {
        setIsVisible(false);
    };

    return (
        <div
            className="relative inline-flex"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={handleFocus}
            onBlur={handleBlur}
        >
            {/* Trigger */}
            <span aria-describedby={isVisible ? tooltipId.current : undefined}>
                {children}
            </span>

            {/* Tooltip */}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        id={tooltipId.current}
                        role="tooltip"
                        initial={styles.initial}
                        animate={styles.animate}
                        exit={styles.initial}
                        transition={{ duration: 0.15 }}
                        className={clsx(
                            'absolute z-[70] px-3 py-1.5 rounded-lg',
                            'bg-[#1D1D1F] border border-white/10',
                            'text-sm text-white whitespace-nowrap',
                            'shadow-lg pointer-events-none',
                            styles.container,
                            className
                        )}
                    >
                        {content}
                        {/* Arrow */}
                        <div
                            className={clsx(
                                'absolute w-0 h-0 border-[6px]',
                                styles.arrow
                            )}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default Tooltip;
