/**
 * Auth Validator Schemas
 *
 * Zod schemas for validating auth-related API inputs.
 */

import { z } from 'zod';

// =============================================================================
// Password Validation
// =============================================================================

const passwordSchema = z
    .string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ in hoa')
    .regex(/[a-z]/, 'Mật khẩu phải có ít nhất 1 chữ thường')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 chữ số');

// =============================================================================
// Register Schema
// =============================================================================

export const RegisterSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email('Định dạng email không hợp lệ').max(254),
    phone: z.string().min(10).max(15).optional(),
    instagram: z.string().max(100).optional(),
    password: passwordSchema,
    shipping_address: z
        .object({
            full_name: z.string().optional(),
            phone: z.string().optional(),
            address_line: z.string().optional(),
            ward: z.string().optional(),
            district: z.string().optional(),
            province: z.string().optional(),
        })
        .optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

// =============================================================================
// Login Schema
// =============================================================================

export const LoginSchema = z.object({
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(1, 'Mật khẩu là bắt buộc'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// =============================================================================
// Forgot Password Schema
// =============================================================================

export const ForgotPasswordSchema = z.object({
    email: z.string().email('Email không hợp lệ'),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

// =============================================================================
// Reset Password Schema
// =============================================================================

export const ResetPasswordSchema = z.object({
    token: z.string().min(1, 'Token là bắt buộc'),
    password: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// =============================================================================
// Verify Email Schema
// =============================================================================

export const VerifyEmailSchema = z.object({
    email: z.string().email(),
    otp: z.string().length(6, 'OTP phải có 6 ký tự'),
});

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
