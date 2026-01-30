'use client';

/**
 * Switch (Spatial Edition)
 * 
 * Features:
 * - Deep Trench Track: Inner shadows simulate depth.
 * - Glowing Thumb: Neon accent bloom when active.
 * - Glassmorphism: Frosted interactions.
 */

import { forwardRef, type ComponentProps } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface SwitchProps extends Omit<ComponentProps<'button'>, 'onChange'> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    size?: 'sm' | 'md' | 'lg';
    label?: string;
}

const sizeConfig = {
    sm: {
        track: 'w-10 h-6',
        thumb: 'w-4 h-4',
        padding: 4,
    },
    md: {
        track: 'w-14 h-8',
        thumb: 'w-6 h-6',
        padding: 4,
    },
    lg: {
        track: 'w-16 h-9',
        thumb: 'w-7 h-7',
        padding: 4,
    },
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
    function Switch(
        {
            checked = false,
            onCheckedChange,
            size = 'md',
            label,
            disabled = false,
            className,
            ...props
        },
        ref
    ) {
        const config = sizeConfig[size];

        const handleClick = () => {
            if (!disabled) {
                onCheckedChange?.(!checked);
            }
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                handleClick();
            }
        };

        return (
            <div className={clsx('inline-flex items-center gap-3', className)}>
                <button
                    ref={ref}
                    role="switch"
                    aria-checked={checked}
                    aria-label={label}
                    disabled={disabled}
                    onClick={handleClick}
                    onKeyDown={handleKeyDown}
                    className={clsx(
                        'relative inline-flex flex-shrink-0 rounded-full transition-all duration-300 ease-in-out cursor-pointer',
                        'border border-white/5',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                        config.track,
                        checked
                            ? 'bg-[var(--color-accent)] shadow-[0_0_15px_var(--color-accent-glow)]'
                            : 'bg-black/40 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]', // Deep trench when off
                        disabled && 'opacity-50 cursor-not-allowed grayscale'
                    )}
                    {...props}
                >
                    <motion.span
                        className={clsx(
                            'block rounded-full bg-white shadow-sm pointer-events-none',
                            config.thumb,
                            checked && "shadow-[0_0_8px_rgba(255,255,255,0.8)]" // White glow on thumb
                        )}
                        initial={false}
                        animate={{
                            x: checked
                                ? (config.track.startsWith('w-10') ? 22 : config.track.startsWith('w-14') ? 28 : 34) // Rough calc based on width - padding
                                : config.padding,
                            scale: checked ? 1.1 : 1
                        }}
                        transition={{
                            type: 'spring',
                            stiffness: 500,
                            damping: 25,
                        }}
                        style={{ marginTop: config.padding, marginLeft: 0 }} // Reset margin, handle via x
                    />
                </button>
                {label && (
                    <span
                        className={clsx(
                            'text-sm font-medium select-none cursor-pointer',
                            disabled ? 'text-white/30' : 'text-white/70 hover:text-white transition-colors'
                        )}
                        onClick={handleClick}
                    >
                        {label}
                    </span>
                )}
            </div>
        );
    }
);

export default Switch;
