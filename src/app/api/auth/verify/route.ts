/**
 * Verify OTP API
 * 
 * POST /api/auth/verify
 * 
 * Verify the OTP code and mark email as verified
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
    try {
        const { email, otp } = await request.json();

        if (!email || !otp) {
            return NextResponse.json(
                { error: 'Email và mã OTP là bắt buộc' },
                { status: 400 }
            );
        }

        // Find verification token
        const { data: token, error: tokenError } = await supabaseAdmin
            .from('verification_tokens')
            .select('*')
            .eq('identifier', email)
            .eq('token', otp)
            .single();

        if (tokenError || !token) {
            return NextResponse.json(
                { error: 'Mã xác thực không đúng' },
                { status: 400 }
            );
        }

        // Check expiry
        if (new Date(token.expires) < new Date()) {
            // Delete expired token
            await supabaseAdmin
                .from('verification_tokens')
                .delete()
                .eq('identifier', email)
                .eq('token', otp);

            return NextResponse.json(
                { error: 'Mã xác thực đã hết hạn. Vui lòng yêu cầu mã mới.' },
                { status: 400 }
            );
        }

        // Mark email as verified (using snake_case column name)
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ email_verified: true })
            .eq('email', email);

        if (updateError) {
            console.error('Profile update error:', updateError);
            // Continue anyway
        }

        // Delete used token (verification complete)
        const { error: deleteError } = await supabaseAdmin
            .from('verification_tokens')
            .delete()
            .eq('identifier', email)
            .eq('token', otp);

        if (deleteError) {
            console.error('Token delete error:', deleteError);
            // Continue anyway
        }

        return NextResponse.json({
            success: true,
            message: 'Email đã được xác thực thành công!',
        });
    } catch (error) {
        console.error('Verify error:', error);
        return NextResponse.json(
            { error: 'Đã có lỗi xảy ra: ' + (error instanceof Error ? error.message : 'Unknown') },
            { status: 500 }
        );
    }
}
