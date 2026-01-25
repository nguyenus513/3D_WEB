/**
 * NextAuth.js Configuration
 *
 * This file configures authentication with:
 * - Credentials Provider (Email/Password)
 * - Custom email verification using our sendEmailWithFallback
 * - Supabase as database adapter
 * - Brute force protection
 */

import NextAuth from 'next-auth';
import type { NextAuthConfig, User } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { SupabaseAdapter } from '@auth/supabase-adapter';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { isLoginBlocked, recordFailedAttempt, clearFailedAttempts } from '@/lib/security/brute-force';

// Supabase client with service role for auth operations
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Need to add this to .env.local
    { auth: { persistSession: false } }
);

/**
 * Extract IP address from request headers
 */
async function getClientIp(): Promise<string> {
    try {
        const headersList = await headers();
        // Check various headers for real IP (behind proxies)
        const forwardedFor = headersList.get('x-forwarded-for');
        if (forwardedFor) {
            return forwardedFor.split(',')[0].trim();
        }
        
        const realIp = headersList.get('x-real-ip');
        if (realIp) {
            return realIp;
        }
        
        const cfConnectingIp = headersList.get('cf-connecting-ip');
        if (cfConnectingIp) {
            return cfConnectingIp;
        }
        
        return '0.0.0.0'; // Fallback
    } catch {
        return '0.0.0.0';
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: SupabaseAdapter({
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    }),
    session: {
        strategy: 'jwt', // Use JWT for session (stateless, faster)
    },
    pages: {
        signIn: '/login',
        newUser: '/register',
        error: '/login',
    },
    providers: [
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                // Security: Minimal logging, no sensitive data
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email và mật khẩu là bắt buộc');
                }

                const email = (credentials.email as string).toLowerCase().trim();
                const ipAddress = await getClientIp();

                // Brute force protection: Check if account/IP is blocked
                try {
                    const blockStatus = await isLoginBlocked(email, ipAddress);
                    if (blockStatus.blocked) {
                        const waitMinutes = blockStatus.blockedUntil
                            ? Math.ceil((blockStatus.blockedUntil.getTime() - Date.now()) / 60000)
                            : 30;
                        throw new Error(`Tài khoản tạm khóa. Thử lại sau ${waitMinutes} phút.`);
                    }
                } catch (blockError) {
                    // If error is from isLoginBlocked, re-throw it; otherwise log and continue
                    if (blockError instanceof Error && blockError.message.includes('Tài khoản tạm khóa')) {
                        throw blockError;
                    }
                    // Non-blocking: allow login if brute force check fails (table might not exist)
                    console.warn('Brute force check failed:', blockError);
                }

                const { data: user, error } = await supabaseAdmin
                    .from('profiles')
                    .select('*')
                    .eq('email', email)
                    .single();

                if (error || !user) {
                    // Record failed attempt (non-blocking)
                    try {
                        await recordFailedAttempt(email, ipAddress);
                    } catch (e) {
                        console.warn('Failed to record login attempt:', e);
                    }
                    // Don't reveal if email exists or not (security best practice)
                    throw new Error('Thông tin đăng nhập không chính xác');
                }

                if (!user.password) {
                    throw new Error('Tài khoản này không dùng mật khẩu');
                }

                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                );

                if (!isValid) {
                    // Record failed attempt (non-blocking)
                    try {
                        const result = await recordFailedAttempt(email, ipAddress);
                        if (result.blocked) {
                            throw new Error('Quá nhiều lần thử. Tài khoản tạm khóa 30 phút.');
                        }
                    } catch (e) {
                        // If error is about blocking, re-throw; otherwise log
                        if (e instanceof Error && e.message.includes('Tài khoản tạm khóa')) {
                            throw e;
                        }
                        console.warn('Failed to record login attempt:', e);
                    }
                    // Same generic message to prevent user enumeration
                    throw new Error('Thông tin đăng nhập không chính xác');
                }

                // Skip email verification check for admin
                if (user.role !== 'admin' && !user.email_verified) {
                    // Check if account has expired (past OTP expiration time - 15 minutes)
                    const createdAt = new Date(user.created_at);
                    const now = new Date();
                    const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

                    if (diffMinutes > 15) {
                        // Account expired - delete it
                        try {
                            await supabaseAdmin.from('addresses').delete().eq('user_id', user.id);
                            await supabaseAdmin.from('verification_tokens').delete().eq('identifier', user.email);
                            await supabaseAdmin.from('profiles').delete().eq('id', user.id);
                            throw new Error('Tài khoản đã hết hạn và bị xóa. Vui lòng đăng ký lại.');
                        } catch {
                            throw new Error('Tài khoản đã hết hạn. Vui lòng đăng ký lại.');
                        }
                    }

                    throw new Error('Email chưa được xác thực. Vui lòng kiểm tra hộp thư.');
                }

                // Successful login: Clear failed attempts (non-blocking)
                try {
                    await clearFailedAttempts(email, ipAddress);
                } catch (e) {
                    console.warn('Failed to clear login attempts:', e);
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.full_name || user.name,
                    image: user.image,
                    role: user.role,
                    customerCode: user.customer_code,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as { role?: string }).role;
                token.customerCode = (user as { customerCode?: string }).customerCode;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                (session.user as { role?: string }).role = token.role as string;
                (session.user as { customerCode?: string }).customerCode = token.customerCode as string;
            }
            return session;
        },
    },
});
