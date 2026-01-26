/**
 * Registration API Route
 *
 * Delegates all logic to AuthController.
 *
 * @see DEVELOPMENT_GUIDE.md - Rule #1: Routes Only Route
 */

import { NextRequest } from 'next/server';
import { authController } from '@/controllers/AuthController';

/**
 * POST /api/auth/register
 * Register a new user
 */
export async function POST(request: NextRequest) {
    return authController.register(request);
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
