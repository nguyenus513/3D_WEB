/**
 * Auth Service
 *
 * Business logic layer for authentication.
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AuthRepository } from '@/repositories/AuthRepository';
import { BadRequestError, ConflictError, RateLimitError } from '@/lib/core/BaseController';
import { RegisterInput, ForgotPasswordInput, ResetPasswordInput, VerifyEmailInput } from '@/validators/auth.schema';

// =============================================================================
// Auth Service
// =============================================================================

export class AuthService {
    constructor(private readonly authRepo: AuthRepository) { }

    /**
     * Register a new user
     */
    async register(input: RegisterInput): Promise<{
        userId: string;
        customerCode: string;
        requiresVerification: boolean;
    }> {
        // Check if email exists
        const exists = await this.authRepo.emailExists(input.email);
        if (exists) {
            throw new ConflictError('Email này đã được đăng ký');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(input.password, 12);

        // Create user
        const user = await this.authRepo.createUser({
            email: input.email.toLowerCase(),
            hashedPassword,
            name: input.name,
            phone: input.phone,
        });

        // Create address if provided
        if (input.shipping_address?.province) {
            await this.authRepo.createAddress(user.id, input.shipping_address);
        }

        // Generate and save OTP
        const otp = this.generateOTP();
        const expires = new Date(Date.now() + 15 * 60 * 1000);
        await this.authRepo.saveVerificationToken(input.email, otp, expires);

        // Send verification email
        await this.sendVerificationEmail(input.email, input.name || 'Bạn', otp);

        return {
            userId: user.id,
            customerCode: user.customer_code,
            requiresVerification: true,
        };
    }

    /**
     * Verify email with OTP
     */
    async verifyEmail(input: VerifyEmailInput): Promise<{ success: boolean }> {
        const valid = await this.authRepo.verifyOtp(input.email, input.otp);
        if (!valid) {
            throw new BadRequestError('Mã xác thực không hợp lệ hoặc đã hết hạn');
        }

        await this.authRepo.markEmailVerified(input.email);
        return { success: true };
    }

    /**
     * Request password reset
     */
    async forgotPassword(input: ForgotPasswordInput): Promise<{ success: boolean; message: string }> {
        const user = await this.authRepo.getUserByEmail(input.email);

        // Always return success to prevent email enumeration
        if (!user) {
            return {
                success: true,
                message: 'Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu.',
            };
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        await this.authRepo.saveResetToken(user.id, tokenHash, expiresAt);

        // Send reset email
        await this.sendResetEmail(input.email, resetToken);

        return {
            success: true,
            message: 'Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu.',
        };
    }

    /**
     * Reset password with token
     */
    async resetPassword(input: ResetPasswordInput): Promise<{ success: boolean }> {
        const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');
        const userId = await this.authRepo.verifyResetToken(tokenHash);

        if (!userId) {
            throw new BadRequestError('Token không hợp lệ hoặc đã hết hạn');
        }

        const hashedPassword = await bcrypt.hash(input.password, 12);
        await this.authRepo.updatePassword(userId, hashedPassword);

        return { success: true };
    }

    // ==========================================================================
    // Private Helpers
    // ==========================================================================

    private generateOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    private async sendVerificationEmail(email: string, name: string, otp: string): Promise<void> {
        try {
            const { sendEmailWithFallback } = await import('@/lib/email/sendEmail');
            const html = this.getVerificationEmailHtml(name, otp);
            const sent = await sendEmailWithFallback({
                to: email,
                subject: `Ma xac thuc Miniver: ${otp}`,
                html,
            });
            if (!sent) console.warn('[AuthService] Verification email was not sent', { email });
        } catch (error) {
            console.error('[AuthService] Failed to send verification email:', error);
        }
    }

    private async sendResetEmail(email: string, token: string): Promise<void> {
        try {
            const { sendEmailWithFallback } = await import('@/lib/email/sendEmail');
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.miniver.id.vn';
            const resetUrl = `${appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
            const sent = await sendEmailWithFallback({
                to: email,
                subject: 'Dat lai mat khau Miniver',
                html: `<p>Xin chao,</p><p>Click vao link nay de dat lai mat khau:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Link co hieu luc trong 1 gio.</p>`,
            });
            if (!sent) console.warn('[AuthService] Reset email was not sent', { email });
        } catch (error) {
            console.error('[AuthService] Failed to send reset email:', error);
        }
    }

    private getVerificationEmailHtml(name: string, otp: string): string {
        return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7;margin:0;padding:40px 0}.container{max-width:500px;margin:0 auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.04)}.header{background:#1d1d1f;color:#fff;padding:32px;text-align:center}.logo{font-size:24px;font-weight:700}.content{padding:40px;text-align:center}h1{font-size:22px;margin:0 0 16px;color:#1d1d1f}p{color:#86868b;font-size:16px;margin:0 0 32px}.otp-box{background:#f5f5f7;border-radius:16px;padding:24px;margin:0 auto}.otp-code{font-size:36px;font-weight:800;letter-spacing:8px;color:#1d1d1f;font-family:monospace}.note{color:#86868b;font-size:13px;margin-top:32px}.footer{background:#f5f5f7;padding:24px;text-align:center;font-size:12px;color:#86868b}</style></head><body><div class="container"><div class="header"><div class="logo">3D Print Shop</div></div><div class="content"><h1>Xác thực email của bạn</h1><p>Xin chào <strong>${name}</strong>,<br>Sử dụng mã dưới đây để hoàn tất đăng ký.</p><div class="otp-box"><div class="otp-code">${otp}</div></div><p class="note">Mã này có hiệu lực trong 15 phút.<br>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p></div><div class="footer">© 2026 3D Print Shop</div></div></body></html>`;
    }
}

