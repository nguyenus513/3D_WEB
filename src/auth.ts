/**
 * NextAuth.js Configuration
 *
 * MongoDB-backed auth for IE213.Q22.
 */

import { randomUUID } from 'node:crypto';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { getMongoCollections } from '@/lib/mongodb';
import { isLoginBlocked, recordFailedAttempt, clearFailedAttempts } from '@/lib/security/brute-force';

const inMemoryLoginAttempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_FALLBACK_ATTEMPTS = 10;
const FALLBACK_BLOCK_DURATION = 15 * 60 * 1000;

function checkFallbackRateLimit(key: string): boolean {
    const now = Date.now();
    const record = inMemoryLoginAttempts.get(key);

    if (record && now < record.blockedUntil) return false;
    if (record && now >= record.blockedUntil) {
        inMemoryLoginAttempts.delete(key);
    }

    return true;
}

function recordFallbackAttempt(key: string): void {
    const record = inMemoryLoginAttempts.get(key) || { count: 0, blockedUntil: 0 };
    record.count++;

    if (record.count >= MAX_FALLBACK_ATTEMPTS) {
        record.blockedUntil = Date.now() + FALLBACK_BLOCK_DURATION;
    }

    inMemoryLoginAttempts.set(key, record);
}

function clearFallbackAttempts(key: string): void {
    inMemoryLoginAttempts.delete(key);
}

function getProfileDisplayName(email: string, name?: string | null): string {
    const fallback = email.split('@')[0]
        .replace(/[._]/g, ' ')
        .replace(/\d+/g, '')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    return name || fallback || 'Khách hàng';
}

async function getClientIp(): Promise<string> {
    try {
        const headersList = await headers();
        const forwardedFor = headersList.get('x-forwarded-for');
        if (forwardedFor) return forwardedFor.split(',')[0].trim();

        const realIp = headersList.get('x-real-ip');
        if (realIp) return realIp;

        const cfConnectingIp = headersList.get('cf-connecting-ip');
        if (cfConnectingIp) return cfConnectingIp;

        return '0.0.0.0';
    } catch {
        return '0.0.0.0';
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
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
                const fallbackKey = `${email}:${ipAddress}`;

                if (!checkFallbackRateLimit(fallbackKey)) {
                    throw new Error('Tài khoản tạm khóa. Thử lại sau 15 phút.');
                }

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
                    console.error('[Auth] Brute force DB check failed, using in-memory fallback');
                }

                const { profiles } = await getMongoCollections();
                const user = await profiles.findOne({ email });

                if (!user) {
                    recordFallbackAttempt(fallbackKey);
                    await recordFailedAttempt(email, ipAddress).catch(() => {});
                    throw new Error('Thông tin đăng nhập không chính xác');
                }

                if (!user.password) {
                    throw new Error('Tài khoản này không dùng mật khẩu');
                }

                const isValid = await bcrypt.compare(credentials.password as string, user.password);

                if (!isValid) {
                    recordFallbackAttempt(fallbackKey);
                    await recordFailedAttempt(email, ipAddress).catch(() => {});
                    throw new Error('Thông tin đăng nhập không chính xác');
                }

                clearFallbackAttempts(fallbackKey);
                await clearFailedAttempts(email, ipAddress).catch(() => {});

                return {
                    id: user._id,
                    email: user.email,
                    name: user.full_name || user.email || email,
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
            if (account?.provider === 'google' && user.email) {
                try {
                    const { profiles } = await getMongoCollections();
                    const email = user.email.toLowerCase();
                    const existingProfile = await profiles.findOne({ email });

                    if (!existingProfile) {
                        const profileId = randomUUID();
                        const { generateId } = await import('@/lib/generateId');
                        const now = new Date();
                        const customerCode = generateId.user();

                        await profiles.insertOne({
                            _id: profileId,
                            email,
                            full_name: getProfileDisplayName(email, user.name),
                            customer_code: customerCode,
                            role: 'customer',
                            email_verified: true,
                            created_at: now,
                            updated_at: now,
                        });

                        user.id = profileId;
                        (user as { isNewUser?: boolean }).isNewUser = true;
                        (user as { role?: string }).role = 'customer';
                        (user as { customerCode?: string }).customerCode = customerCode;
                    } else {
                        user.id = existingProfile._id;
                        (user as { role?: string }).role = existingProfile.role || 'customer';
                        (user as { customerCode?: string }).customerCode = existingProfile.customer_code || undefined;
                        (user as { isNewUser?: boolean }).isNewUser = existingProfile.role !== 'admin' && !existingProfile.phone;
                    }
                } catch (error) {
                    console.error('[Auth] Google signIn error:', error);
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
                    const { profiles } = await getMongoCollections();
                    const profile = await profiles.findOne({ email: (email as string).toLowerCase() });

                    if (profile) {
                        token.id = profile._id;
                        token.role = profile.role;
                        token.customerCode = profile.customer_code;
                        token.isNewUser = profile.role !== 'admin' && !profile.phone;
                    }
                } catch (error) {
                    console.error('[Auth] JWT profile refresh error:', error);
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
