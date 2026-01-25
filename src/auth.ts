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
import Google from 'next-auth/providers/google';
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
    // Temporarily disable adapter to test Google OAuth
    // adapter: SupabaseAdapter({
    //     url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    //     secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // }),
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

                // DEBUG: Simplified - temporarily skip brute force protection
                console.log('[AUTH DEBUG] Login attempt for:', email);

                /* TEMPORARILY DISABLED - Brute force protection
                const ipAddress = await getClientIp();

                try {
                    const blockStatus = await isLoginBlocked(email, ipAddress);
                    if (blockStatus.blocked) {
                        const waitMinutes = blockStatus.blockedUntil
                            ? Math.ceil((blockStatus.blockedUntil.getTime() - Date.now()) / 60000)
                            : 30;
                        throw new Error(`Tài khoản tạm khóa. Thử lại sau ${waitMinutes} phút.`);
                    }
                } catch (blockError) {
                    if (blockError instanceof Error && blockError.message.includes('Tài khoản tạm khóa')) {
                        throw blockError;
                    }
                    console.warn('Brute force check failed:', blockError);
                }
                */

                const { data: user, error } = await supabaseAdmin
                    .from('profiles')
                    .select('*')
                    .eq('email', email)
                    .single();

                // DEBUG: Log query result (temporary - remove in production)
                console.log('[AUTH DEBUG] Email lookup:', { email, found: !!user, error: error?.message });

                if (error || !user) {
                    // Brute force recording disabled for debugging
                    console.log('[AUTH DEBUG] User not found or error:', error?.message);
                    throw new Error('Thông tin đăng nhập không chính xác');
                }

                if (!user.password) {
                    console.log('[AUTH DEBUG] User has no password field');
                    throw new Error('Tài khoản này không dùng mật khẩu');
                }

                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                );

                if (!isValid) {
                    // Brute force recording disabled for debugging
                    console.log('[AUTH DEBUG] Password mismatch');
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

                // DEBUG: Skip clearing failed attempts
                console.log('[AUTH DEBUG] Login successful for:', email);

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
        // Google OAuth Provider - only add if credentials exist
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [
            Google({
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                allowDangerousEmailAccountLinking: true,
            }),
        ] : []),
    ],
    callbacks: {
        async signIn({ user, account }) {
            console.log('[AUTH DEBUG] signIn callback called');
            console.log('[AUTH DEBUG] Provider:', account?.provider);
            console.log('[AUTH DEBUG] User email:', user?.email);

            // Temporarily simplified - just allow all sign ins
            // Profile creation will happen in complete-profile page
            if (account?.provider === 'google') {
                console.log('[AUTH DEBUG] Google login - allowing');
                (user as { isNewUser?: boolean }).isNewUser = true;
            }

            console.log('[AUTH DEBUG] signIn returning true');
            return true;
        },
        async jwt({ token, user, account }) {
            if (user) {
                token.id = user.id;
                token.role = (user as { role?: string }).role;
                token.customerCode = (user as { customerCode?: string }).customerCode;

                // Pass isNewUser flag for Google OAuth redirect
                if (account?.provider === 'google') {
                    token.isNewUser = (user as { isNewUser?: boolean }).isNewUser || false;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                (session.user as { role?: string }).role = token.role as string;
                (session.user as { customerCode?: string }).customerCode = token.customerCode as string;
                (session.user as { isNewUser?: boolean }).isNewUser = token.isNewUser as boolean;
            }
            return session;
        },
    },
});
