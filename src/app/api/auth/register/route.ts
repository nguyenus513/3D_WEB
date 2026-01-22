/**
 * Registration API
 * 
 * POST /api/auth/register
 * 
 * 1. Create user with hashed password
 * 2. Generate OTP code
 * 3. Send verification email via sendEmailWithFallback
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

// Generate 6-digit OTP
function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
    try {
        const { name, email, phone, instagram, password, shipping_address } = await request.json();

        // Validate input
        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email và mật khẩu là bắt buộc' },
                { status: 400 }
            );
        }

        // Instagram is optional now

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Mật khẩu phải có ít nhất 6 ký tự' },
                { status: 400 }
            );
        }

        // Check if email already exists
        const { data: existingUser } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            // User already exists
            return NextResponse.json(
                { error: 'Email này đã được đăng ký' },
                { status: 400 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Generate customer code
        const customerCode = 'USR-' + Math.random().toString(36).substring(2, 10).toUpperCase();

        // Generate user ID
        const userId = crypto.randomUUID();

        // Create user in profiles table
        const { data: newUser, error: createError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: userId,
                full_name: name || null,
                name: name || null,
                email,
                phone: phone || null,
                instagram_username: instagram || null,
                password: hashedPassword,
                customer_code: customerCode,
                role: 'customer', // This will be cast to user_role ENUM automatically
            })
            .select('id, customer_code')
            .single();

        if (createError) {
            console.error('Create user error:', createError);
            return NextResponse.json(
                { error: 'Không thể tạo tài khoản: ' + createError.message },
                { status: 500 }
            );
        }

        // Create address if provided (normalized table)
        if (shipping_address && shipping_address.province) {
            await supabaseAdmin.from('addresses').insert({
                user_id: newUser.id,
                full_name: shipping_address.recipient_name || name || null,
                phone: shipping_address.recipient_phone || phone || null,
                address_line: shipping_address.address_line || null,
                ward: shipping_address.ward || null,
                district: shipping_address.district || null,
                province: shipping_address.province,
                label: 'Mặc định',
                is_default: true,
            });
        }

        // Generate OTP
        const otp = generateOTP();
        const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Save OTP to verification_tokens
        const { error: tokenError } = await supabaseAdmin.from('verification_tokens').insert({
            identifier: email,
            token: otp,
            expires: expires.toISOString(),
        });

        if (tokenError) {
            console.error('Token insert error:', tokenError);
            // Continue anyway - user can request new OTP later
        }

        // Send verification email
        try {
            await sendVerificationEmail(email, name || 'Bạn', otp);
        } catch (emailError) {
            console.error('Email send error:', emailError);
            // Continue anyway - return success with note
        }

        return NextResponse.json({
            message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực.',
            requiresVerification: true,
            userId: newUser.id,
            customerCode: newUser.customer_code,
        });
    } catch (error) {
        console.error('Register error:', error);
        return NextResponse.json(
            { error: 'Đã có lỗi xảy ra: ' + (error instanceof Error ? error.message : 'Unknown') },
            { status: 500 }
        );
    }
}

/**
 * Send OTP email using our fallback system
 */
async function sendVerificationEmail(email: string, name: string, otp: string) {
    // Import dynamically to avoid circular dependency
    const { sendEmailWithFallback } = await import('@/lib/email/sendEmail');

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7;margin:0;padding:40px 0}
.container{max-width:500px;margin:0 auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.04)}
.header{background:#1d1d1f;color:#fff;padding:32px;text-align:center}
.logo{font-size:24px;font-weight:700}
.content{padding:40px;text-align:center}
h1{font-size:22px;margin:0 0 16px;color:#1d1d1f}
p{color:#86868b;font-size:16px;margin:0 0 32px}
.otp-box{background:#f5f5f7;border-radius:16px;padding:24px;margin:0 auto}
.otp-code{font-size:36px;font-weight:800;letter-spacing:8px;color:#1d1d1f;font-family:monospace}
.note{color:#86868b;font-size:13px;margin-top:32px}
.footer{background:#f5f5f7;padding:24px;text-align:center;font-size:12px;color:#86868b}
</style>
</head>
<body>
<div class="container">
    <div class="header"><div class="logo">3D Print Shop</div></div>
    <div class="content">
        <h1>Xác thực email của bạn</h1>
        <p>Xin chào <strong>${name}</strong>,<br>Sử dụng mã dưới đây để hoàn tất đăng ký.</p>
        <div class="otp-box">
            <div class="otp-code">${otp}</div>
        </div>
        <p class="note">Mã này có hiệu lực trong 15 phút.<br>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
    </div>
    <div class="footer">© 2026 3D Print Shop</div>
</div>
</body>
</html>`;

    await sendEmailWithFallback({
        to: email,
        subject: `🔐 Mã xác thực: ${otp}`,
        html,
    });
}
