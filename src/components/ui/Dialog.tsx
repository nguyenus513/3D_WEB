'use client';

/**
 * Dialog/Modal Component
 * 
 * Accessible modal dialog with focus trapping and keyboard navigation.
 * Follows ui-ux-pro-max accessibility and animation guidelines.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconX } from '@tabler/icons-react';
import { clsx } from 'clsx';

// =============================================================================
// Types
// =============================================================================

interface DialogProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    title?: string;
    description?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    showCloseButton?: boolean;
    closeOnOverlayClick?: boolean;
    closeOnEscape?: boolean;
    className?: string;
}

// =============================================================================
// Size Map
// =============================================================================

const sizeMap = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-[90vw] max-h-[90vh]',
};

// =============================================================================
// Dialog Component
// =============================================================================

export function Dialog({
    open,
    onClose,
    children,
    title,
    description,
    size = 'md',
    showCloseButton = true,
    closeOnOverlayClick = true,
    closeOnEscape = true,
    className,
}: DialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<Element | null>(null);

    // Handle escape key
    useEffect(() => {
        if (!open || !closeOnEscape) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, closeOnEscape, onClose]);

    // Focus management
    useEffect(() => {
        if (open) {
            previousActiveElement.current = document.activeElement;
            dialogRef.current?.focus();
        } else if (previousActiveElement.current instanceof HTMLElement) {
            previousActiveElement.current.focus();
        }
    }, [open]);

    // Lock body scroll when open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={closeOnOverlayClick ? onClose : undefined}
                        aria-hidden="true"
                    />

                    {/* Dialog */}
                    <motion.div
                        ref={dialogRef}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={title ? 'dialog-title' : undefined}
                        aria-describedby={description ? 'dialog-description' : undefined}
                        tabIndex={-1}
                        className={clsx(
                            'relative w-full mx-4 p-6 rounded-2xl',
                            'bg-[#1D1D1F] border border-white/10',
                            'shadow-2xl',
                            sizeMap[size],
                            className
                        )}
                    >
                        {/* Header */}
                        {(title || showCloseButton) && (
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div>
                                    {title && (
                                        <h2
                                            id="dialog-title"
                                            className="text-xl font-semibold text-white"
                                        >
                                            {title}
                                        </h2>
                                    )}
                                    {description && (
                                        <p
                                            id="dialog-description"
                                            className="mt-1 text-sm text-white/60"
                                        >
                                            {description}
                                        </p>
                                    )}
                                </div>
                                {showCloseButton && (
                                    <button
                                        onClick={onClose}
                                        className={clsx(
                                            'flex-shrink-0 p-2 rounded-lg',
                                            'hover:bg-white/10 transition-colors cursor-pointer',
                                            'focus:outline-none focus:ring-2 focus:ring-[#0071E3]/50'
                                        )}
                                        aria-label="Close dialog"
                                    >
                                        <IconX size={20} className="text-white/60" />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Content */}
                        <div className="text-white">{children}</div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

// =============================================================================
// Dialog Parts for Composition
// =============================================================================

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={clsx('mb-4', className)}>{children}</div>;
}

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <h2 className={clsx('text-xl font-semibold text-white', className)}>
            {children}
        </h2>
    );
}

export function DialogDescription({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <p className={clsx('mt-1 text-sm text-white/60', className)}>
            {children}
        </p>
    );
}

export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={clsx('py-2', className)}>{children}</div>;
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={clsx('flex items-center justify-end gap-3 mt-6', className)}>
            {children}
        </div>
    );
}

export default Dialog;
