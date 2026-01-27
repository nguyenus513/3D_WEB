'use client';

/**
 * Accordion Component
 * 
 * Expandable accordion with single or multiple open items.
 * Follows WAI-ARIA accordion pattern.
 */

import { useState, createContext, useContext, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconChevronDown } from '@tabler/icons-react';
import { clsx } from 'clsx';

// =============================================================================
// Types
// =============================================================================

type AccordionType = 'single' | 'multiple';

interface AccordionContextType {
    type: AccordionType;
    openItems: string[];
    toggleItem: (value: string) => void;
}

interface AccordionProps {
    type?: AccordionType;
    defaultValue?: string[];
    children: ReactNode;
    className?: string;
}

interface AccordionItemProps {
    value: string;
    children: ReactNode;
    className?: string;
}

interface AccordionTriggerProps {
    children: ReactNode;
    className?: string;
}

interface AccordionContentProps {
    children: ReactNode;
    className?: string;
}

// =============================================================================
// Context
// =============================================================================

const AccordionContext = createContext<AccordionContextType | undefined>(undefined);
const AccordionItemContext = createContext<string | undefined>(undefined);

function useAccordionContext() {
    const context = useContext(AccordionContext);
    if (!context) {
        throw new Error('Accordion components must be used within an Accordion');
    }
    return context;
}

function useAccordionItemContext() {
    const context = useContext(AccordionItemContext);
    if (!context) {
        throw new Error('AccordionTrigger and AccordionContent must be used within AccordionItem');
    }
    return context;
}

// =============================================================================
// Accordion Root
// =============================================================================

export function Accordion({
    type = 'single',
    defaultValue = [],
    children,
    className,
}: AccordionProps) {
    const [openItems, setOpenItems] = useState<string[]>(defaultValue);

    const toggleItem = (value: string) => {
        if (type === 'single') {
            setOpenItems((prev) => (prev.includes(value) ? [] : [value]));
        } else {
            setOpenItems((prev) =>
                prev.includes(value)
                    ? prev.filter((item) => item !== value)
                    : [...prev, value]
            );
        }
    };

    return (
        <AccordionContext.Provider value={{ type, openItems, toggleItem }}>
            <div className={clsx('space-y-2', className)}>{children}</div>
        </AccordionContext.Provider>
    );
}

// =============================================================================
// Accordion Item
// =============================================================================

export function AccordionItem({ value, children, className }: AccordionItemProps) {
    return (
        <AccordionItemContext.Provider value={value}>
            <div
                className={clsx(
                    'rounded-xl border border-white/10 bg-white/5 overflow-hidden',
                    className
                )}
            >
                {children}
            </div>
        </AccordionItemContext.Provider>
    );
}

// =============================================================================
// Accordion Trigger
// =============================================================================

export function AccordionTrigger({ children, className }: AccordionTriggerProps) {
    const { openItems, toggleItem } = useAccordionContext();
    const value = useAccordionItemContext();
    const isOpen = openItems.includes(value);

    return (
        <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={`accordion-content-${value}`}
            onClick={() => toggleItem(value)}
            className={clsx(
                'flex w-full items-center justify-between gap-4 px-4 py-4',
                'text-left font-medium text-white',
                'hover:bg-white/5 transition-colors cursor-pointer',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]/50 focus-visible:ring-inset',
                className
            )}
        >
            <span>{children}</span>
            <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
            >
                <IconChevronDown size={20} className="text-white/60" />
            </motion.span>
        </button>
    );
}

// =============================================================================
// Accordion Content
// =============================================================================

export function AccordionContent({ children, className }: AccordionContentProps) {
    const { openItems } = useAccordionContext();
    const value = useAccordionItemContext();
    const isOpen = openItems.includes(value);

    return (
        <AnimatePresence initial={false}>
            {isOpen && (
                <motion.div
                    id={`accordion-content-${value}`}
                    role="region"
                    aria-labelledby={`accordion-trigger-${value}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                >
                    <div className={clsx('px-4 pb-4 text-white/70', className)}>
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default Accordion;
