/**
 * Admin Auth Guard
 * 
 * Reusable authentication guard for admin API routes.
 * ALWAYS use this in admin APIs to prevent unauthorized access.
 * Supports 2FA verification via httpOnly cookie.
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { securityLog, getIpFromRequest, getUserAgentFromRequest } from './logger';
import { cookies } from 'next/headers';
import { getAdminSupabase } from '@/lib/supabase/admin';

interface AdminCheckResult {
    authorized: boolean;
    userId?: string;
    response?: NextResponse;
}

/**
 * Check if current request is from an authenticated admin
 * Returns a response object if unauthorized (use it directly)
 * 
 * @param request - The incoming request
 * @param skip2FA - Skip 2FA check (for 2FA setup/verify endpoints)
 * 
 * @example
 * export async function GET(request: Request) {
 *     const { authorized, response, userId } = await requireAdmin(request);
 *     if (!authorized) return response;
 *     
 *     // Continue with admin logic...
 * }
 */
export async function requireAdmin(request?: Request, skip2FA = false): Promise<AdminCheckResult> {
    try {
        const session = await auth();

        if (!session?.user) {
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

        // Check 2FA if not skipped
        if (!skip2FA) {
            try {
                const supabase = getAdminSupabase();
                const { data: profile } = await supabase
                    .from('users')
                    .select('totp_enabled')
                    .eq('id', userId)
                    .single();

                if (profile?.totp_enabled) {
                    const cookieStore = await cookies();
                    const twoFACookie = cookieStore.get('2fa-verified');

                    if (!twoFACookie || twoFACookie.value !== userId) {
                        return {
                            authorized: false,
                            response: NextResponse.json(
                                { error: '2FA verification required', requires2FA: true },
                                { status: 403 }
                            ),
                        };
                    }
                }
            } catch (twoFAError) {
                const { createLogger } = await import('@/lib/logger');
                createLogger('admin-guard').error('2FA check failed, denying access', twoFAError);
                return {
                    authorized: false,
                    response: NextResponse.json(
                        { error: '2FA verification error' },
                        { status: 500 }
                    ),
                };
            }
        }

        // Admin verified
        return {
            authorized: true,
            userId,
        };
    } catch (error) {
        const { createLogger } = await import('@/lib/logger');
        createLogger('admin-guard').error('Admin auth check error', error);
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
