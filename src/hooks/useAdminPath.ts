'use client';

import { usePathname } from 'next/navigation';

/**
 * Hook to get the dynamic admin root path.
 * Admin pages are accessed via random 50-char tokens which change per session.
 * This hook detects the current token from the URL and provides a base path.
 * 
 * @returns The dynamic admin root path (e.g., /A7x...Z9k)
 */
export function useAdminPath() {
    const pathname = usePathname();

    // Extract first path segment
    const pathParts = pathname.split('/');
    const firstSegment = pathParts.length >= 2 ? pathParts[1] : '';

    // If it's a long random token (50 chars), use it as root
    // Otherwise, fallback to sys_internal (for direct access during dev)
    const adminRoot = firstSegment.length >= 40 ? `/${firstSegment}` : '/sys_internal';

    return { adminRoot };
}
