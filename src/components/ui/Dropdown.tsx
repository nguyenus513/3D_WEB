'use client';

/**
 * Dropdown Menu Component
 * 
 * Accessible dropdown menu with keyboard navigation.
 * Follows WAI-ARIA menu pattern.
 */

import {
    useState,
    useRef,
    useEffect,
    createContext,
    useContext,
    type ReactNode,
    type KeyboardEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconCheck, IconChevronRight } from '@tabler/icons-react';
import { clsx } from 'clsx';
import { useJellyMotion } from '@/lib/jelly';

// =============================================================================
// Types
// =============================================================================

interface DropdownContextType {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    activeIndex: number;
    setActiveIndex: (index: number) => void;
}

interface DropdownProps {
    children: ReactNode;
    className?: string;
}

interface DropdownTriggerProps {
    children: ReactNode;
    className?: string;
    asChild?: boolean;
}

interface DropdownContentProps {
    children: ReactNode;
    align?: 'start' | 'center' | 'end';
    side?: 'top' | 'bottom';
    className?: string;
}

interface DropdownItemProps {
    children: ReactNode;
    onSelect?: () => void;
    disabled?: boolean;
    icon?: ReactNode;
    shortcut?: string;
    className?: string;
}

interface DropdownCheckboxItemProps extends DropdownItemProps {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

// =============================================================================
// Context
// =============================================================================

const DropdownContext = createContext<DropdownContextType | undefined>(undefined);

function useDropdownContext() {
    const context = useContext(DropdownContext);
    if (!context) {
        throw new Error('Dropdown components must be used within a Dropdown');
    }
    return context;
}

// =============================================================================
// Dropdown Root
// =============================================================================

export function Dropdown({ children, className }: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen]);

    return (
        <DropdownContext.Provider value={{ isOpen, setIsOpen, activeIndex, setActiveIndex }}>
            <div ref={dropdownRef} className={clsx('relative inline-block', className)}>
                {children}
            </div>
        </DropdownContext.Provider>
    );
}

// =============================================================================
// Dropdown Trigger
// =============================================================================

export function DropdownTrigger({ children, className }: DropdownTriggerProps) {
    const { isOpen, setIsOpen } = useDropdownContext();
    const jellyMotion = useJellyMotion({ hoverScale: 1.02, tapScale: 0.98, hoverY: -1 });

    return (
        <motion.button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            onClick={() => setIsOpen(!isOpen)}
            className={clsx('cursor-pointer jelly-interactive', className)}
            {...jellyMotion}
        >
            {children}
        </motion.button>
    );
}

// =============================================================================
// Dropdown Content
// =============================================================================

export function DropdownContent({
    children,
    align = 'start',
    side = 'bottom',
    className,
}: DropdownContentProps) {
    const { isOpen, setIsOpen, setActiveIndex } = useDropdownContext();
    const contentRef = useRef<HTMLDivElement>(null);

    const alignStyles = {
        start: 'left-0',
        center: 'left-1/2 -translate-x-1/2',
        end: 'right-0',
    };

    const sideStyles = {
        top: 'bottom-full mb-2',
        bottom: 'top-full mt-2',
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const items = contentRef.current?.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])');
        if (!items) return;

        const itemArray = Array.from(items) as HTMLElement[];
        const currentIndex = itemArray.findIndex((el) => el === document.activeElement);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                const nextIndex = currentIndex < itemArray.length - 1 ? currentIndex + 1 : 0;
                itemArray[nextIndex]?.focus();
                setActiveIndex(nextIndex);
                break;
            case 'ArrowUp':
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : itemArray.length - 1;
                itemArray[prevIndex]?.focus();
                setActiveIndex(prevIndex);
                break;
            case 'Home':
                e.preventDefault();
                itemArray[0]?.focus();
                setActiveIndex(0);
                break;
            case 'End':
                e.preventDefault();
                itemArray[itemArray.length - 1]?.focus();
                setActiveIndex(itemArray.length - 1);
                break;
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={contentRef}
                    role="menu"
                    aria-orientation="vertical"
                    initial={{ opacity: 0, scale: 0.95, y: side === 'bottom' ? -10 : 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: side === 'bottom' ? -10 : 10 }}
                    transition={{ duration: 0.15 }}
                    onKeyDown={handleKeyDown}
                    className={clsx(
                        'absolute z-50 min-w-[180px] py-1.5 rounded-xl',
                        'bg-[#1D1D1F] border border-white/10',
                        'shadow-xl backdrop-blur-xl',
                        alignStyles[align],
                        sideStyles[side],
                        className
                    )}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// =============================================================================
// Dropdown Item
// =============================================================================

export function DropdownItem({
    children,
    onSelect,
    disabled = false,
    icon,
    shortcut,
    className,
}: DropdownItemProps) {
    const { setIsOpen } = useDropdownContext();
    const jellyMotion = useJellyMotion({ disabled, hoverScale: 1.02, tapScale: 0.98, hoverY: 0 });

    const handleClick = () => {
        if (!disabled) {
            onSelect?.();
            setIsOpen(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
        }
    };

    return (
        <motion.div
            role="menuitem"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={clsx(
                'flex items-center gap-2 px-3 py-2 mx-1.5 rounded-lg',
                'text-sm text-white/80 cursor-pointer',
                'outline-none transition-colors',
                !disabled && 'hover:bg-white/10 focus:bg-white/10',
                disabled && 'opacity-50 cursor-not-allowed',
                'jelly-interactive',
                className
            )}
            {...jellyMotion}
        >
            {icon && <span className="flex-shrink-0 text-white/60">{icon}</span>}
            <span className="flex-1">{children}</span>
            {shortcut && (
                <span className="flex-shrink-0 text-xs text-white/40">{shortcut}</span>
            )}
        </motion.div>
    );
}

// =============================================================================
// Dropdown Checkbox Item
// =============================================================================

export function DropdownCheckboxItem({
    children,
    checked = false,
    onCheckedChange,
    disabled = false,
    className,
}: DropdownCheckboxItemProps) {
    const jellyMotion = useJellyMotion({ disabled, hoverScale: 1.02, tapScale: 0.98, hoverY: 0 });

    const handleClick = () => {
        if (!disabled) {
            onCheckedChange?.(!checked);
        }
    };

    return (
        <motion.div
            role="menuitemcheckbox"
            aria-checked={checked}
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            onClick={handleClick}
            className={clsx(
                'flex items-center gap-2 px-3 py-2 mx-1.5 rounded-lg',
                'text-sm text-white/80 cursor-pointer',
                'outline-none transition-colors',
                !disabled && 'hover:bg-white/10 focus:bg-white/10',
                disabled && 'opacity-50 cursor-not-allowed',
                'jelly-interactive',
                className
            )}
            {...jellyMotion}
        >
            <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                {checked && <IconCheck size={14} className="text-[#0071E3]" />}
            </span>
            <span className="flex-1">{children}</span>
        </motion.div>
    );
}

// =============================================================================
// Dropdown Separator
// =============================================================================

export function DropdownSeparator({ className }: { className?: string }) {
    return (
        <div
            role="separator"
            className={clsx('my-1.5 h-px bg-white/10', className)}
        />
    );
}

// =============================================================================
// Dropdown Label
// =============================================================================

export function DropdownLabel({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={clsx(
                'px-3 py-1.5 text-xs font-medium text-white/40 uppercase tracking-wider',
                className
            )}
        >
            {children}
        </div>
    );
}

export default Dropdown;
