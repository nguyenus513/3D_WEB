/**
 * Admin Auth Guard
 * 
 * Reusable authentication guard for admin API routes.
 * ALWAYS use this in admin APIs to prevent unauthorized access.
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { securityLog, getIpFromRequest, getUserAgentFromRequest } from './logger';

interface AdminCheckResult {
    authorized: boolean;
    userId?: string;
    response?: NextResponse;
}

/**
 * Check if current request is from an authenticated admin
 * Returns a response object if unauthorized (use it directly)
 * 
 * @example
 * export async function GET(request: Request) {
 *     const { authorized, response, userId } = await requireAdmin(request);
 *     if (!authorized) return response;
 *     
 *     // Continue with admin logic...
 * }
 */
export async function requireAdmin(request?: Request): Promise<AdminCheckResult> {
    try {
        const session = await auth();

        if (!session?.user) {
            // Not logged in
            if (request) {
                securityLog.permissionDenied(undefined, 'admin_api', request);
            }
            return {
                authorized: false,
                response: NextResponse.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                ),
            };
        }

        const userId = session.user.id;
        const role = (session.user as { role?: string }).role;

        if (role !== 'admin') {
            // Logged in but not admin
            if (request) {
                securityLog.permissionDenied(userId, 'admin_api', request);
            }
            return {
                authorized: false,
                response: NextResponse.json(
                    { error: 'Forbidden' },
                    { status: 403 }
                ),
            };
        }

        // Admin verified
        return {
            authorized: true,
            userId,
        };
    } catch (error) {
        console.error('Admin auth check error:', error);
        return {
            authorized: false,
            response: NextResponse.json(
                { error: 'Authentication error' },
                { status: 500 }
            ),
        };
    }
}

/**
 * Simple admin check without response (for use in existing isAdmin patterns)
 */
export async function isAdmin(): Promise<boolean> {
    const session = await auth();
    return (session?.user as { role?: string } | undefined)?.role === 'admin';
}
