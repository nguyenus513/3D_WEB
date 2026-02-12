import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isRateLimited } from '@/lib/security';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
export async function POST(request: NextRequest) {
    try {
        // Rate limiting
        const { limited } = isRateLimited(request);
        if (limited) {
            return NextResponse.json(
                { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
                { status: 429 }
            );
        }

        const { token, password } = await request.json();

        if (!token || !password) {
            return NextResponse.json(
                { error: 'Token và mật khẩu là bắt buộc' },
                { status: 400 }
            );
        }

        // Validate password strength
        if (password.length < 8) {
            return NextResponse.json(
                { error: 'Mật khẩu phải có ít nhất 8 ký tự' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        // Hash the token to compare
        const tokenHash = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Find valid token
        const { data: resetToken, error: tokenError } = await supabase
            .from('password_reset_tokens')
            .select('user_id, expires_at')
            .eq('token_hash', tokenHash)
            .single();

        if (tokenError || !resetToken) {
            return NextResponse.json(
                { error: 'Link đặt lại mật khẩu không hợp lệ' },
                { status: 400 }
            );
        }

        // Check if token expired
        if (new Date(resetToken.expires_at) < new Date()) {
            // Delete expired token
            await supabase
                .from('password_reset_tokens')
                .delete()
                .eq('token_hash', tokenHash);

            return NextResponse.json(
                { error: 'Link đặt lại mật khẩu đã hết hạn' },
                { status: 400 }
            );
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Update password in auth.users using Supabase Admin API
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            resetToken.user_id,
            { password: password }
        );

        if (updateError) {
            console.error('[ResetPassword] Update error:', updateError);
            return NextResponse.json(
                { error: 'Không thể cập nhật mật khẩu' },
                { status: 500 }
            );
        }

        // Delete used token
        await supabase
            .from('password_reset_tokens')
            .delete()
            .eq('user_id', resetToken.user_id);

        const { createLogger } = await import('@/lib/logger');
        createLogger('reset-password').info('Password reset successful', { userId: resetToken.user_id });

        return NextResponse.json({
            success: true,
            message: 'Mật khẩu đã được cập nhật thành công',
        });
    } catch (error) {
        console.error('[ResetPassword] Error:', error);
        return NextResponse.json(
            { error: 'Có lỗi xảy ra' },
            { status: 500 }
        );
    }
}
