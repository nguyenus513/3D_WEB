'use client';

/**
 * Alert Component
 * 
 * Status alerts for success, error, warning, and info messages.
 * Follows ui-ux-pro-max accessibility guidelines.
 */

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { IconCheck, IconX, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { clsx } from 'clsx';

// =============================================================================
// Types
// =============================================================================

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
    variant?: AlertVariant;
    title?: string;
    children: ReactNode;
    icon?: ReactNode;
    dismissible?: boolean;
    onDismiss?: () => void;
    className?: string;
}

// =============================================================================
// Variant Config
// =============================================================================

const variantConfig = {
    success: {
        icon: IconCheck,
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
        iconColor: 'text-green-500',
        iconBg: 'bg-green-500/20',
    },
    error: {
        icon: IconX,
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        iconColor: 'text-red-500',
        iconBg: 'bg-red-500/20',
    },
    warning: {
        icon: IconAlertTriangle,
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/20',
        iconColor: 'text-yellow-500',
        iconBg: 'bg-yellow-500/20',
    },
    info: {
        icon: IconInfoCircle,
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        iconColor: 'text-blue-500',
        iconBg: 'bg-blue-500/20',
    },
};

// =============================================================================
// Alert Component
// =============================================================================

export function Alert({
    variant = 'info',
    title,
    children,
    icon,
    dismissible = false,
    onDismiss,
    className,
}: AlertProps) {
    const config = variantConfig[variant];
    const Icon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            role="alert"
            className={clsx(
                'flex items-start gap-3 p-4 rounded-xl border',
                config.bg,
                config.border,
                className
            )}
        >
            {/* Icon */}
            <div className={clsx('flex-shrink-0 p-1.5 rounded-lg', config.iconBg)}>
                {icon || <Icon size={16} className={config.iconColor} />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {title && (
                    <h3 className="text-sm font-medium text-white mb-1">{title}</h3>
                )}
                <div className="text-sm text-white/70">{children}</div>
            </div>

            {/* Dismiss Button */}
            {dismissible && (
                <button
                    onClick={onDismiss}
                    className={clsx(
                        'flex-shrink-0 p-1 rounded-lg',
                        'hover:bg-white/10 transition-colors cursor-pointer',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20'
                    )}
                    aria-label="Dismiss alert"
                >
                    <IconX size={16} className="text-white/40 hover:text-white/60" />
                </button>
            )}
        </motion.div>
    );
}

export default Alert;
