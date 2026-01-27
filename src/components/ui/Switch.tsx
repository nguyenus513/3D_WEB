'use client';

/**
 * Switch/Toggle Component
 * 
 * Accessible toggle switch following WAI-ARIA switch pattern.
 */

import { forwardRef, type ComponentProps } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

// =============================================================================
// Types
// =============================================================================

interface SwitchProps extends Omit<ComponentProps<'button'>, 'onChange'> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    size?: 'sm' | 'md' | 'lg';
    label?: string;
}

// =============================================================================
// Size Config
// =============================================================================

const sizeConfig = {
    sm: {
        track: 'w-8 h-5',
        thumb: 'w-3.5 h-3.5',
        translate: 'translate-x-3.5',
    },
    md: {
        track: 'w-11 h-6',
        thumb: 'w-5 h-5',
        translate: 'translate-x-5',
    },
    lg: {
        track: 'w-14 h-7',
        thumb: 'w-6 h-6',
        translate: 'translate-x-7',
    },
};

// =============================================================================
// Switch Component
// =============================================================================

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
            <div className={clsx('inline-flex items-center gap-2', className)}>
                <button
                    ref={ref}
                    role="switch"
                    aria-checked={checked}
                    aria-label={label}
                    disabled={disabled}
                    onClick={handleClick}
                    onKeyDown={handleKeyDown}
                    className={clsx(
                        'relative inline-flex flex-shrink-0 rounded-full',
                        'transition-colors duration-200 ease-in-out cursor-pointer',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]',
                        config.track,
                        checked ? 'bg-[#0071E3]' : 'bg-white/20',
                        disabled && 'opacity-50 cursor-not-allowed'
                    )}
                    {...props}
                >
                    <motion.span
                        className={clsx(
                            'inline-block rounded-full bg-white shadow-sm',
                            config.thumb
                        )}
                        initial={false}
                        animate={{
                            x: checked ? (size === 'sm' ? 14 : size === 'md' ? 20 : 28) : 2,
                        }}
                        transition={{
                            type: 'spring',
                            stiffness: 500,
                            damping: 30,
                        }}
                        style={{ marginTop: 2 }}
                    />
                </button>
                {label && (
                    <span
                        className={clsx(
                            'text-sm',
                            disabled ? 'text-white/40' : 'text-white/80'
                        )}
                    >
                        {label}
                    </span>
                )}
            </div>
        );
    }
);

export default Switch;
