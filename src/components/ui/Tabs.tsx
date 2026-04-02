'use client';

/**
 * Tabs Component
 * 
 * Accessible tab navigation with keyboard support.
 * Follows WAI-ARIA tab pattern and ui-ux-pro-max guidelines.
 */

import { useState, createContext, useContext, useRef, type ReactNode, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useJellyMotion } from '@/lib/jelly';

// =============================================================================
// Types
// =============================================================================

interface TabsContextType {
    activeTab: string;
    setActiveTab: (value: string) => void;
}

interface TabsProps {
    defaultValue: string;
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
    className?: string;
}

interface TabsListProps {
    children: ReactNode;
    className?: string;
}

interface TabsTriggerProps {
    value: string;
    children: ReactNode;
    className?: string;
    disabled?: boolean;
}

interface TabsContentProps {
    value: string;
    children: ReactNode;
    className?: string;
}

// =============================================================================
// Context
// =============================================================================

const TabsContext = createContext<TabsContextType | undefined>(undefined);

function useTabsContext() {
    const context = useContext(TabsContext);
    if (!context) {
        throw new Error('Tabs components must be used within a Tabs provider');
    }
    return context;
}

// =============================================================================
// Tabs Root
// =============================================================================

export function Tabs({
    defaultValue,
    value,
    onValueChange,
    children,
    className,
}: TabsProps) {
    const [internalValue, setInternalValue] = useState(defaultValue);
    const activeTab = value ?? internalValue;

    const setActiveTab = (newValue: string) => {
        if (!value) {
            setInternalValue(newValue);
        }
        onValueChange?.(newValue);
    };

    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab }}>
            <div className={clsx('w-full', className)}>{children}</div>
        </TabsContext.Provider>
    );
}

// =============================================================================
// Tabs List
// =============================================================================

export function TabsList({ children, className }: TabsListProps) {
    const listRef = useRef<HTMLDivElement>(null);

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const triggers = listRef.current?.querySelectorAll('[role="tab"]:not([disabled])');
        if (!triggers) return;

        const triggerArray = Array.from(triggers) as HTMLElement[];
        const currentIndex = triggerArray.findIndex((el) => el === document.activeElement);

        let nextIndex = currentIndex;

        switch (e.key) {
            case 'ArrowRight':
                nextIndex = (currentIndex + 1) % triggerArray.length;
                e.preventDefault();
                break;
            case 'ArrowLeft':
                nextIndex = (currentIndex - 1 + triggerArray.length) % triggerArray.length;
                e.preventDefault();
                break;
            case 'Home':
                nextIndex = 0;
                e.preventDefault();
                break;
            case 'End':
                nextIndex = triggerArray.length - 1;
                e.preventDefault();
                break;
        }

        triggerArray[nextIndex]?.focus();
    };

    return (
        <div
            ref={listRef}
            role="tablist"
            aria-orientation="horizontal"
            onKeyDown={handleKeyDown}
            className={clsx(
                'inline-flex items-center gap-1 p-1 rounded-xl',
                'bg-white/5 border border-white/10',
                className
            )}
        >
            {children}
        </div>
    );
}

// =============================================================================
// Tabs Trigger
// =============================================================================

export function TabsTrigger({
    value,
    children,
    className,
    disabled = false,
}: TabsTriggerProps) {
    const { activeTab, setActiveTab } = useTabsContext();
    const isActive = activeTab === value;
    const jellyMotion = useJellyMotion({ disabled });

    return (
        <motion.button
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${value}`}
            tabIndex={isActive ? 0 : -1}
            disabled={disabled}
            onClick={() => !disabled && setActiveTab(value)}
            className={clsx(
                'relative px-4 py-2 text-sm font-medium rounded-lg',
                'transition-colors duration-200 cursor-pointer min-h-[44px]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]/50',
                disabled && 'opacity-50 cursor-not-allowed',
                !isActive && !disabled && 'text-white/60 hover:text-white hover:bg-white/5',
                isActive && 'text-white',
                'jelly-interactive',
                className
            )}
            {...jellyMotion}
        >
            {isActive && (
                <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white/10 rounded-lg"
                    transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
                />
            )}
            <span className="relative z-10">{children}</span>
        </motion.button>
    );
}

// =============================================================================
// Tabs Content
// =============================================================================

export function TabsContent({ value, children, className }: TabsContentProps) {
    const { activeTab } = useTabsContext();
    const isActive = activeTab === value;

    if (!isActive) return null;

    return (
        <motion.div
            role="tabpanel"
            id={`tabpanel-${value}`}
            aria-labelledby={`tab-${value}`}
            tabIndex={0}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={clsx('mt-4 focus:outline-none', className)}
        >
            {children}
        </motion.div>
    );
}

export default Tabs;
