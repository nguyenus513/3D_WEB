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
        maxAge: 86400, // 24 hours (default is 30 days)
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

            // Handle Google OAuth sign in
            if (account?.provider === 'google' && user.email) {
                console.log('[AUTH DEBUG] Processing Google OAuth for:', user.email);
                try {
                    // Check if user exists in profiles
                    const { data: existingProfile, error: queryError } = await supabaseAdmin
                        .from('profiles')
                        .select('id, phone')
                        .eq('email', user.email.toLowerCase())
                        .maybeSingle();

                    console.log('[AUTH DEBUG] Query result:', { existingProfile, queryError });

                    if (!existingProfile) {
                        // No profile found - create new one
                        console.log('[AUTH DEBUG] Creating new profile for Google user');
                        const { generateId } = await import('@/lib/generateId');
                        const customerCode = generateId.user();

                        const { data: newProfile, error: insertError } = await supabaseAdmin
                            .from('profiles')
                            .insert({
                                email: user.email.toLowerCase(),
                                // Extract name from Google profile or email
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
                            })
                            .select('id')
                            .single();

                        if (insertError) {
                            console.error('[AUTH DEBUG] Insert error:', insertError);
                        } else {
                            console.log('[AUTH DEBUG] Profile created with ID:', newProfile?.id);
                            // IMPORTANT: Set the database ID on user object
                            if (newProfile?.id) {
                                user.id = newProfile.id;
                            }
                        }

                        // Mark as new user - needs to complete profile
                        (user as { isNewUser?: boolean }).isNewUser = true;
                    } else {
                        // Profile exists - use database ID
                        user.id = existingProfile.id;
                        console.log('[AUTH DEBUG] Using existing profile ID:', existingProfile.id);

                        // Check if complete (has phone)
                        const isProfileIncomplete = !existingProfile.phone;
                        (user as { isNewUser?: boolean }).isNewUser = isProfileIncomplete;
                        console.log('[AUTH DEBUG] Existing user, isNewUser:', isProfileIncomplete);
                    }
                } catch (error) {
                    console.error('[AUTH DEBUG] Google signIn error:', error);
                    // Allow login to proceed even if profile check fails
                    (user as { isNewUser?: boolean }).isNewUser = true;
                }
            }

            console.log('[AUTH DEBUG] signIn returning true');
            return true;
        },
        async jwt({ token, user, account }) {
            // For Google OAuth, ALWAYS fetch profile ID from database
            if (account?.provider === 'google' && user?.email) {
                console.log('[AUTH DEBUG] JWT callback - fetching profile for Google user:', user.email);

                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('id, role, customer_code')
                    .eq('email', (user.email as string).toLowerCase())
                    .single();

                if (profile) {
                    console.log('[AUTH DEBUG] JWT - using database profile ID:', profile.id);
                    token.id = profile.id;
                    token.role = profile.role;
                    token.customerCode = profile.customer_code;
                } else {
                    console.log('[AUTH DEBUG] JWT - no profile found, using user.id');
                    token.id = user.id;
                }

                // Pass isNewUser flag for Google OAuth redirect
                token.isNewUser = (user as { isNewUser?: boolean }).isNewUser || false;
            } else if (user) {
                // For credentials login, use user data directly
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
                (session.user as { isNewUser?: boolean }).isNewUser = token.isNewUser as boolean;
            }
            return session;
        },
    },
});
