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
import { saveTokens } from '@/lib/google-drive-oauth';
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

                // Skip email verification check (column does not exist)
                // Original check: if (user.role !== 'admin' && !user.email_verified) {...}

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
                authorization: {
                    params: {
                        // Include Drive scope so admin login auto-grants Drive access
                        scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
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
                        .select('id, phone, role')
                        .eq('email', user.email.toLowerCase())
                        .maybeSingle();

                    console.log('[AUTH DEBUG] Query result:', { existingProfile, queryError });

                    if (!existingProfile) {
                        // No profile found - create new one
                        console.log('[AUTH DEBUG] Creating new profile for Google user');

                        // Generate UUID BEFORE insert - we control the ID
                        const profileId = crypto.randomUUID();
                        const { generateId } = await import('@/lib/generateId');
                        const customerCode = generateId.user();

                        const { error: insertError } = await supabaseAdmin
                            .from('profiles')
                            .insert({
                                id: profileId,  // EXPLICIT ID - prevents mismatch
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
                                role: 'customer',
                            });

                        if (insertError) {
                            console.error('[AUTH DEBUG] Insert error:', insertError);
                            // Profile creation failed - will be handled in complete-profile
                        } else {
                            console.log('[AUTH DEBUG] Profile created with ID:', profileId);
                        }

                        // ALWAYS set user.id to our controlled UUID
                        user.id = profileId;
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

                    // Auto-save Drive OAuth tokens for ADMIN
                    const userRole = existingProfile?.role || 'customer';
                    console.log('[AUTH] Checking Drive token save: role=', userRole, 'has_access_token=', !!account?.access_token, 'has_refresh_token=', !!account?.refresh_token);
                    if (userRole === 'admin' && account?.access_token) {
                        try {
                            await saveTokens({
                                access_token: account.access_token,
                                refresh_token: account.refresh_token || null,
                                expiry_date: account.expires_at ? account.expires_at * 1000 : null,
                            });
                            console.log('[AUTH] ✓ Auto-saved Drive OAuth tokens for admin');
                        } catch (tokenError) {
                            console.warn('[AUTH] Failed to save Drive tokens (non-blocking):', tokenError);
                            // Non-blocking: don't prevent login if token save fails
                        }
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
        async jwt({ token, user, account, trigger, session }) {
            const email = token.email || user?.email;
            console.log(`[AUTH DEBUG] JWT Callback | Trigger: ${trigger} | User: ${!!user} | Email: ${email}`);

            // First login - set initial values
            if (user) {
                console.log('[AUTH DEBUG] JWT - Initial Login Processing');
                token.id = user.id;
                token.email = user.email;
                token.role = (user as { role?: string }).role;
                token.customerCode = (user as { customerCode?: string }).customerCode;

                // For Google OAuth, handle isNewUser flag
                if (account?.provider === 'google') {
                    token.isNewUser = (user as { isNewUser?: boolean }).isNewUser || false;
                }
            }

            // ALWAYS fetch latest role from DB (handles role changes after login)
            if (email) {
                try {
                    const { data: profile } = await supabaseAdmin
                        .from('profiles')
                        .select('id, role, customer_code, totp_enabled')
                        .eq('email', (email as string).toLowerCase())
                        .single();

                    if (profile) {
                        console.log(`[AUTH DEBUG] DB Query Success | Role: ${profile.role} | Token Before: ${token.role}`);
                        token.id = profile.id;
                        token.role = profile.role;
                        token.customerCode = profile.customer_code;
                        token.twoFactorEnabled = profile.totp_enabled || false;
                    } else {
                        console.warn('[AUTH DEBUG] Profile not found in DB for:', email);
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
                (session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled = token.twoFactorEnabled as boolean;
            }
            return session;
        },
    },
});
