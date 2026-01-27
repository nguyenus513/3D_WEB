'use client';

/**
 * Toast Notification Component
 * 
 * Provides toast notifications for success, error, warning, and info messages.
 * Follows ui-ux-pro-max accessibility guidelines.
 * 
 * @see ui-ux-pro-max/SKILL.md - Accessibility & Animation
 */

import { useState, useEffect, createContext, useContext, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconCheck, IconX, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { clsx } from 'clsx';

// =============================================================================
// Types
// =============================================================================

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
}

// =============================================================================
// Context
// =============================================================================

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

// =============================================================================
// Provider
// =============================================================================

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = crypto.randomUUID();
        setToasts((prev) => [...prev, { ...toast, id }]);

        // Auto remove after duration (default 5s)
        const duration = toast.duration ?? 5000;
        if (duration > 0) {
            setTimeout(() => removeToast(id), duration);
        }
    }, [removeToast]);

    const success = useCallback((title: string, message?: string) => {
        addToast({ type: 'success', title, message });
    }, [addToast]);

    const error = useCallback((title: string, message?: string) => {
        addToast({ type: 'error', title, message, duration: 7000 }); // Longer for errors
    }, [addToast]);

    const warning = useCallback((title: string, message?: string) => {
        addToast({ type: 'warning', title, message });
    }, [addToast]);

    const info = useCallback((title: string, message?: string) => {
        addToast({ type: 'info', title, message });
    }, [addToast]);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

// =============================================================================
// Toast Container
// =============================================================================

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
    return (
        <div
            className="fixed bottom-6 right-6 z-[80] flex flex-col gap-3 pointer-events-none"
            role="region"
            aria-label="Notifications"
        >
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} onRemove={() => onRemove(toast.id)} />
                ))}
            </AnimatePresence>
        </div>
    );
}

// =============================================================================
// Toast Item
// =============================================================================

const iconMap = {
    success: IconCheck,
    error: IconX,
    warning: IconAlertTriangle,
    info: IconInfoCircle,
};

const styleMap = {
    success: {
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
        icon: 'text-green-500',
        iconBg: 'bg-green-500/20',
    },
    error: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        icon: 'text-red-500',
        iconBg: 'bg-red-500/20',
    },
    warning: {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/20',
        icon: 'text-yellow-500',
        iconBg: 'bg-yellow-500/20',
    },
    info: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        icon: 'text-blue-500',
        iconBg: 'bg-blue-500/20',
    },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
    const Icon = iconMap[toast.type];
    const styles = styleMap[toast.type];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className={clsx(
                'pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl',
                'min-w-[320px] max-w-[400px] shadow-lg',
                styles.bg,
                styles.border
            )}
            role="alert"
            aria-live="polite"
        >
            {/* Icon */}
            <div className={clsx('flex-shrink-0 p-1.5 rounded-lg', styles.iconBg)}>
                <Icon size={16} className={styles.icon} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{toast.title}</p>
                {toast.message && (
                    <p className="mt-1 text-sm text-white/60">{toast.message}</p>
                )}
            </div>

            {/* Close Button */}
            <button
                onClick={onRemove}
                className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Dismiss notification"
            >
                <IconX size={16} className="text-white/40 hover:text-white/60" />
            </button>
        </motion.div>
    );
}

// =============================================================================
// Standalone Toast (for simple use cases)
// =============================================================================

export function Toast({
    type = 'info',
    title,
    message,
    onClose,
    visible = true,
}: {
    type?: ToastType;
    title: string;
    message?: string;
    onClose?: () => void;
    visible?: boolean;
}) {
    const Icon = iconMap[type];
    const styles = styleMap[type];

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className={clsx(
                        'flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl',
                        styles.bg,
                        styles.border
                    )}
                    role="alert"
                >
                    <div className={clsx('flex-shrink-0 p-1.5 rounded-lg', styles.iconBg)}>
                        <Icon size={16} className={styles.icon} />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-white">{title}</p>
                        {message && <p className="mt-1 text-sm text-white/60">{message}</p>}
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            aria-label="Dismiss"
                        >
                            <IconX size={16} className="text-white/40" />
                        </button>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default Toast;
