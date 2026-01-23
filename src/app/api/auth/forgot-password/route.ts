import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isRateLimited } from '@/lib/security';
import crypto from 'crypto';

/**
 * POST /api/auth/forgot-password
 * Send password reset email
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

        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: 'Email là bắt buộc' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        // Check if user exists (don't reveal if user doesn't exist)
        const { data: user } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('email', email.toLowerCase())
            .single();

        // Always return success to prevent email enumeration
        if (!user) {
            console.log('[ForgotPassword] Email not found:', email);
            return NextResponse.json({
                success: true,
                message: 'Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu.',
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        // Store token in database
        await supabase
            .from('password_reset_tokens')
            .upsert({
                user_id: user.id,
                token_hash: resetTokenHash,
                expires_at: expiresAt.toISOString(),
                created_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id',
            });

        // Send email (placeholder - integrate with your email service)
        const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;

        console.log('[ForgotPassword] Reset URL generated:', resetUrl);

        // TODO: Send actual email using your email service
        // await sendEmail({
        //     to: email,
        //     subject: 'Đặt lại mật khẩu',
        //     html: `Click vào link này để đặt lại mật khẩu: <a href="${resetUrl}">${resetUrl}</a>`,
        // });

        return NextResponse.json({
            success: true,
            message: 'Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu.',
        });
    } catch (error) {
        console.error('[ForgotPassword] Error:', error);
        return NextResponse.json(
            { error: 'Có lỗi xảy ra' },
            { status: 500 }
        );
    }
}
