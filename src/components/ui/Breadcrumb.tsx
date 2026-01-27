'use client';

/**
 * Breadcrumb Component
 * 
 * Navigation breadcrumbs with proper accessibility.
 * Follows WAI-ARIA breadcrumb pattern.
 */

import { type ReactNode } from 'react';
import Link from 'next/link';
import { IconChevronRight, IconHome } from '@tabler/icons-react';
import { clsx } from 'clsx';

// =============================================================================
// Types
// =============================================================================

interface BreadcrumbItem {
    label: string;
    href?: string;
    icon?: ReactNode;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
    separator?: ReactNode;
    showHome?: boolean;
    homeHref?: string;
    className?: string;
}

// =============================================================================
// Breadcrumb Component
// =============================================================================

export function Breadcrumb({
    items,
    separator,
    showHome = true,
    homeHref = '/',
    className,
}: BreadcrumbProps) {
    const allItems: BreadcrumbItem[] = showHome
        ? [{ label: 'Home', href: homeHref, icon: <IconHome size={16} /> }, ...items]
        : items;

    return (
        <nav aria-label="Breadcrumb" className={clsx('', className)}>
            <ol className="flex items-center gap-2 text-sm">
                {allItems.map((item, index) => {
                    const isLast = index === allItems.length - 1;

                    return (
                        <li key={index} className="flex items-center gap-2">
                            {/* Item */}
                            {item.href && !isLast ? (
                                <Link
                                    href={item.href}
                                    className={clsx(
                                        'flex items-center gap-1.5 text-white/60',
                                        'hover:text-white transition-colors',
                                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]/50 focus-visible:rounded'
                                    )}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </Link>
                            ) : (
                                <span
                                    className={clsx(
                                        'flex items-center gap-1.5',
                                        isLast ? 'text-white font-medium' : 'text-white/60'
                                    )}
                                    aria-current={isLast ? 'page' : undefined}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </span>
                            )}

                            {/* Separator */}
                            {!isLast && (
                                <span className="text-white/30" aria-hidden="true">
                                    {separator || <IconChevronRight size={16} />}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

// =============================================================================
// Simple Breadcrumb Wrapper
// =============================================================================

interface BreadcrumbSimpleProps {
    children: ReactNode;
    className?: string;
}

export function BreadcrumbList({ children, className }: BreadcrumbSimpleProps) {
    return (
        <nav aria-label="Breadcrumb" className={className}>
            <ol className="flex items-center gap-2 text-sm">{children}</ol>
        </nav>
    );
}

export function BreadcrumbItem({
    children,
    href,
    isCurrentPage = false,
    className,
}: {
    children: ReactNode;
    href?: string;
    isCurrentPage?: boolean;
    className?: string;
}) {
    return (
        <li className={clsx('flex items-center gap-2', className)}>
            {href && !isCurrentPage ? (
                <Link
                    href={href}
                    className="text-white/60 hover:text-white transition-colors"
                >
                    {children}
                </Link>
            ) : (
                <span
                    className={isCurrentPage ? 'text-white font-medium' : 'text-white/60'}
                    aria-current={isCurrentPage ? 'page' : undefined}
                >
                    {children}
                </span>
            )}
        </li>
    );
}

export function BreadcrumbSeparator({ className }: { className?: string }) {
    return (
        <li className={clsx('text-white/30', className)} aria-hidden="true">
            <IconChevronRight size={16} />
        </li>
    );
}

export default Breadcrumb;
