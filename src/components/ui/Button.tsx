'use client';

/**
 * Button (Spatial Edition)
 * 
 * Features:
 * - Liquid Physics (Spring scale)
 * - Neon Glow (Box shadow bloom)
 * - Glass variant support
 * - Exports styles for use in Links
 */

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'glass';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

// Export styles for reuse in Links
export const buttonBaseStyles = 'relative inline-flex items-center justify-center gap-2 font-semibold rounded-full cursor-pointer overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';

export const buttonVariants = {
    primary: `
        bg-[var(--color-accent)] text-white 
        shadow-[0_0_20px_-5px_var(--color-accent-glow)] 
        border border-white/10
        hover:shadow-[0_0_30px_var(--color-accent-glow)] hover:scale-[1.02]
    `,
    secondary: `
        bg-[var(--material-glass)] text-[var(--text-primary)] 
        border-white/10 border backdrop-blur-[var(--blur-glass)]
        hover:bg-white/10 hover:scale-[1.02]
    `,
    outline: `
        bg-transparent text-[var(--text-primary)] 
        border border-[var(--edge-light)] 
        hover:bg-white/5 hover:scale-[1.02]
    `,
    ghost: 'bg-transparent text-[var(--text-primary)] hover:bg-white/5',
    glass: `
        bg-[var(--material-glass)] text-white
        backdrop-blur-md border border-white/20
        shadow-[var(--shadow-2)]
        hover:bg-white/20 hover:scale-[1.02]
    `
};

export const buttonSizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
};

// Wrap HTML button with motion but keep standard props type compatibility
const MotionBtn = motion.button;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
        return (
            <MotionBtn
                ref={ref}
                whileHover={!disabled && !isLoading ? { y: -1 } : undefined}
                whileTap={!disabled && !isLoading ? { scale: 0.98 } : undefined}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className={clsx(buttonBaseStyles, buttonVariants[variant], buttonSizes[size], className)}
                disabled={disabled || isLoading}
                {...(props as HTMLMotionProps<"button">)} // Cast props for Motion
            >
                {/* Loading Spinner */}
                {isLoading && (
                    <motion.svg
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        className="animate-spin h-5 w-5 mr-2"
                        viewBox="0 0 24 24"
                    >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </motion.svg>
                )}

                {/* Content */}
                <span className="relative z-10 flex items-center gap-2">
                    {children}
                </span>

                {/* Shimmer Effect for Primary */}
                {variant === 'primary' && !disabled && (
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent skew-x-12 translate-x-[-150%] group-hover:animate-shimmer" />
                )}
            </MotionBtn>
        );
    }
);

Button.displayName = 'Button';
