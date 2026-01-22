/**
 * Token Refresh API
 * 
 * POST /api/auth/refresh
 * Refreshes access token using refresh token (with rotation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { refreshSession } from '@/lib/security/session-manager';
import { securityLog, getIpFromRequest } from '@/lib/security/logger';

export async function POST(request: NextRequest) {
    try {
        // Get refresh token from cookie or body
        const refreshToken = request.cookies.get('refresh_token')?.value
            || (await request.json().catch(() => ({})))?.refresh_token;

        if (!refreshToken) {
            return NextResponse.json(
                { error: 'Refresh token required' },
                { status: 400 }
            );
        }

        // Attempt token refresh with rotation
        const result = await refreshSession(refreshToken);

        if (!result) {
            // Token invalid or compromised
            securityLog.suspicious(request, 'invalid_refresh_token', {
                ip: getIpFromRequest(request),
            });

            // Clear cookies
            const response = NextResponse.json(
                { error: 'Invalid refresh token' },
                { status: 401 }
            );
            response.cookies.delete('refresh_token');
            response.cookies.delete('session_id');
            return response;
        }

        // Set new refresh token in httpOnly cookie
        const response = NextResponse.json({
            success: true,
            session: {
                id: result.session.id,
                expiresAt: result.session.expires_at,
            },
        });

        // Secure cookie settings
        response.cookies.set('refresh_token', result.newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 30 * 24 * 60 * 60, // 30 days
        });

        response.cookies.set('session_id', result.session.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60, // 7 days
        });

        return response;
    } catch (error) {
        console.error('Token refresh error:', error);
        return NextResponse.json(
            { error: 'Token refresh failed' },
            { status: 500 }
        );
    }
}
