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
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { isLoginBlocked, recordFailedAttempt, clearFailedAttempts } from '@/lib/security/brute-force';

// Supabase client with service role for auth operations
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

/**
 * Extract IP address from request headers
 */
async function getClientIp(): Promise<string> {
    try {
        const headersList = await headers();
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

        return '0.0.0.0';
    } catch {
        return '0.0.0.0';
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    // Adapter intentionally disabled (JWT strategy + custom profiles table)
    session: {
        strategy: 'jwt',
        maxAge: 86400,
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
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email và mật khẩu là bắt buộc');
                }

                const email = (credentials.email as string).toLowerCase().trim();
                const ipAddress = await getClientIp();

                // Brute force protection
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
                    if (process.env.NODE_ENV !== 'production') {
                        console.warn('Brute force check failed:', blockError);
                    }
                }

                const { data: user, error } = await supabaseAdmin
                    .from('profiles')
                    .select('*')
                    .eq('email', email)
                    .single();

                if (error || !user) {
                    await recordFailedAttempt(email, ipAddress).catch(() => null);
                    throw new Error('Thông tin đăng nhập không chính xác');
                }

                if (!user.password) {
                    await recordFailedAttempt(email, ipAddress).catch(() => null);
                    throw new Error('Tài khoản này không dùng mật khẩu');
                }

                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                );

                if (!isValid) {
                    const attempt = await recordFailedAttempt(email, ipAddress).catch(() => null);
                    if (attempt?.blocked) {
                        const waitMinutes = attempt.blockedUntil
                            ? Math.ceil((attempt.blockedUntil.getTime() - Date.now()) / 60000)
                            : 30;
                        throw new Error(`Tài khoản tạm khóa. Thử lại sau ${waitMinutes} phút.`);
                    }
                    throw new Error('Thông tin đăng nhập không chính xác');
                }

                // Skip email verification check for admin
                if (user.role !== 'admin' && !user.email_verified) {
                    const createdAt = new Date(user.created_at);
                    const now = new Date();
                    const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

                    if (diffMinutes > 15) {
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

                await clearFailedAttempts(email, ipAddress).catch(() => null);

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
            // Handle Google OAuth sign in
            if (account?.provider === 'google' && user.email) {
                try {
                    const { data: existingProfile } = await supabaseAdmin
                        .from('profiles')
                        .select('id, phone')
                        .eq('email', user.email.toLowerCase())
                        .maybeSingle();

                    if (!existingProfile) {
                        const profileId = crypto.randomUUID();
                        const { generateId } = await import('@/lib/generateId');
                        const customerCode = generateId.user();

                        const { error: insertError } = await supabaseAdmin
                            .from('profiles')
                            .insert({
                                id: profileId,
                                email: user.email.toLowerCase(),
                                full_name: user.name || user.email.split('@')[0]
                                    .replace(/[._]/g, ' ')
                                    .replace(/\d+/g, '')
                                    .trim()
                                    .split(' ')
                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                                    .join(' ') || 'Khách hàng',
                                customer_code: customerCode,
                                email_verified: true,
                                role: 'customer',
                            });

                        if (!insertError) {
                            user.id = profileId;
                            (user as { isNewUser?: boolean }).isNewUser = true;
                        } else {
                            console.error('[AUTH] Insert error:', insertError);
                            (user as { isNewUser?: boolean }).isNewUser = true;
                        }
                    } else {
                        user.id = existingProfile.id;
                        const isProfileIncomplete = !existingProfile.phone;
                        (user as { isNewUser?: boolean }).isNewUser = isProfileIncomplete;
                    }
                } catch (error) {
                    console.error('[AUTH] Google signIn error:', error);
                    (user as { isNewUser?: boolean }).isNewUser = true;
                }
            }

            return true;
        },
        async jwt({ token, user, account }) {
            const email = token.email || user?.email;

            if (user) {
                token.id = user.id;
                token.email = user.email;
                token.role = (user as { role?: string }).role;
                token.customerCode = (user as { customerCode?: string }).customerCode;

                if (account?.provider === 'google') {
                    token.isNewUser = (user as { isNewUser?: boolean }).isNewUser || false;
                }
            }

            if (email) {
                try {
                    const { data: profile } = await supabaseAdmin
                        .from('profiles')
                        .select('id, role, customer_code')
                        .eq('email', (email as string).toLowerCase())
                        .single();

                    if (profile) {
                        token.id = profile.id;
                        token.role = profile.role;
                        token.customerCode = profile.customer_code;
                    }
                } catch (error) {
                    console.error('[AUTH] Error fetching profile in JWT callback:', error);
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
