/**
 * User Sessions API
 * 
 * GET: List active sessions for current user
 * DELETE: Revoke session(s)
 * POST: Revoke all sessions (logout everywhere)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserSessions, revokeSession, revokeAllSessions } from '@/lib/security/session-manager';
import { securityLog, getIpFromRequest } from '@/lib/security/logger';

/**
 * GET /api/auth/sessions
 * Get all active sessions for current user
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const sessions = await getUserSessions(session.user.id);

        // Hide sensitive data and mark current session
        const currentSessionId = request.cookies.get('session_id')?.value;

        const sanitizedSessions = sessions.map(s => ({
            id: s.id,
            deviceName: s.device_name,
            ipAddress: s.ip_address ? maskIp(s.ip_address) : null,
            lastActiveAt: s.last_active_at,
            createdAt: s.created_at,
            isCurrent: s.id === currentSessionId,
        }));

        return NextResponse.json({ sessions: sanitizedSessions });
    } catch (error) {
        console.error('Get sessions error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}

/**
 * DELETE /api/auth/sessions?id=xxx
 * Revoke a specific session
 */
export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('id');

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }

        const success = await revokeSession(sessionId, session.user.id);

        if (!success) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Log the action
        securityLog.adminAction(
            session.user.id,
            'revoke_session',
            sessionId,
            request
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Revoke session error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}

/**
 * POST /api/auth/sessions/revoke-all
 * Revoke all sessions (logout everywhere)
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const success = await revokeAllSessions(session.user.id);

        if (!success) {
            return NextResponse.json({ error: 'Failed to revoke sessions' }, { status: 500 });
        }

        // Log the action
        securityLog.adminAction(
            session.user.id,
            'revoke_all_sessions',
            session.user.id,
            request
        );

        return NextResponse.json({
            success: true,
            message: 'Đã đăng xuất khỏi tất cả thiết bị'
        });
    } catch (error) {
        console.error('Revoke all sessions error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}

/**
 * Mask IP address for privacy
 */
function maskIp(ip: string): string {
    if (ip.includes('.')) {
        // IPv4: 192.168.1.xxx
        const parts = ip.split('.');
        return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    } else if (ip.includes(':')) {
        // IPv6: mask last segments
        const parts = ip.split(':');
        return parts.slice(0, 4).join(':') + ':xxxx:xxxx';
    }
    return 'xxx.xxx.xxx.xxx';
}
