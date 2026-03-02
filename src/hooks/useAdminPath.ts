'use client';

/**
 * Admin Path Hook
 *
 * Returns the admin root path for navigation links.
 * All admin routes are under /admin.
 */
export function useAdminPath() {
    return { adminRoot: '/admin' };
}
