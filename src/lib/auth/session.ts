/**
 * Session Helpers for NextAuth
 * 
 * Use these in Server Components to check authentication
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Session } from 'next-auth';

/**
 * Get current session (for optional auth)
 */
export async function getSession(): Promise<Session | null> {
    return await auth();
}

/**
 * Require authentication - redirects to login if not logged in
 */
export async function requireAuth(): Promise<Session> {
    const session = await auth();
    if (!session?.user) {
        redirect('/login');
    }
    return session;
}

/**
 * Require admin role - redirects to home if not admin
 */
export async function requireAdmin(): Promise<Session> {
    const session = await auth();
    if (!session?.user) {
        redirect('/login');
    }
    if ((session.user as { role?: string }).role !== 'admin') {
        redirect('/');
    }
    return session;
}

/**
 * Check if user is admin (for conditional rendering)
 */
export async function isAdmin(): Promise<boolean> {
    const session = await auth();
    return (session?.user as { role?: string } | undefined)?.role === 'admin';
}
