/**
 * Auth Controller
 *
 * Request handling layer for auth APIs.
 */

import { NextRequest } from 'next/server';
import { BaseController, RateLimitError } from '@/lib/core/BaseController';
import { AuthService } from '@/services/AuthService';
import { AuthRepository } from '@/repositories/AuthRepository';
import {
    RegisterSchema,
    ForgotPasswordSchema,
    ResetPasswordSchema,
    VerifyEmailSchema,
} from '@/validators/auth.schema';
import { checkRateLimit } from '@/lib/security/redis-rate-limit';
import { securityLog, getIpFromRequest, sanitizeObject } from '@/lib/security';

// =============================================================================
// Auth Controller
// =============================================================================

export class AuthController extends BaseController {
    private readonly authService: AuthService;

    constructor() {
        super();
        const authRepo = new AuthRepository();
        this.authService = new AuthService(authRepo);
    }

    /**
     * POST /api/auth/register
     */
    async register(request: NextRequest) {
        return this.wrapHandler(async () => {
            const ip = getIpFromRequest(request);

            // Rate limiting
            const { allowed, resetIn } = await checkRateLimit(`register:${ip}`, 'auth:register');
            if (!allowed) {
                securityLog.rateLimited(request, '/api/auth/register');
                throw new RateLimitError('Quá nhiều yêu cầu. Vui lòng thử lại sau.');
            }

            // Parse and validate input
            const rawBody = await request.json();
            const sanitized = sanitizeObject(rawBody);
            const input = RegisterSchema.parse(sanitized);

            // Register user
            const result = await this.authService.register(input);

            return this.handleSuccess({
                message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực.',
                ...result,
            }, { status: 201 });
        }, 'AuthController.register');
    }

    /**
     * POST /api/auth/verify
     */
    async verifyEmail(request: NextRequest) {
        return this.wrapHandler(async () => {
            const ip = getIpFromRequest(request);

            // Rate limiting — prevent OTP brute force
            const { allowed } = await checkRateLimit(`verify:${ip}`, 'auth:verify');
            if (!allowed) {
                securityLog.rateLimited(request, '/api/auth/verify');
                throw new RateLimitError('Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau.');
            }

            const body = await request.json();
            const input = VerifyEmailSchema.parse(body);

            const result = await this.authService.verifyEmail(input);

            return this.handleSuccess({
                message: 'Xác thực email thành công!',
                ...result,
            });
        }, 'AuthController.verifyEmail');
    }

    /**
     * POST /api/auth/forgot-password
     */
    async forgotPassword(request: NextRequest) {
        return this.wrapHandler(async () => {
            const ip = getIpFromRequest(request);

            // Rate limiting — prevent email spam (3 per hour)
            const { allowed } = await checkRateLimit(`forgot:${ip}`, 'auth:forgot-password');
            if (!allowed) {
                securityLog.rateLimited(request, '/api/auth/forgot-password');
                throw new RateLimitError('Quá nhiều yêu cầu. Vui lòng thử lại sau.');
            }

            const body = await request.json();
            const input = ForgotPasswordSchema.parse(body);

            const result = await this.authService.forgotPassword(input);

            return this.handleSuccess(result);
        }, 'AuthController.forgotPassword');
    }

    /**
     * POST /api/auth/reset-password
     */
    async resetPassword(request: NextRequest) {
        return this.wrapHandler(async () => {
            const body = await request.json();
            const input = ResetPasswordSchema.parse(body);

            const result = await this.authService.resetPassword(input);

            return this.handleSuccess({
                message: 'Đặt lại mật khẩu thành công!',
                ...result,
            });
        }, 'AuthController.resetPassword');
    }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const authController = new AuthController();

