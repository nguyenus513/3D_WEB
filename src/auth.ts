/**
 * NextAuth.js Configuration
 * 
 * This file configures authentication with:
 * - Credentials Provider (Email/Password)
 * - Custom email verification using our sendEmailWithFallback
 * - Supabase as database adapter
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { SupabaseAdapter } from '@auth/supabase-adapter';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

// Supabase client with service role for auth operations
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Need to add this to .env.local
    { auth: { persistSession: false } }
);

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

                const { data: user, error } = await supabaseAdmin
                    .from('profiles')
                    .select('*')
                    .eq('email', credentials.email)
                    .single();

                if (error || !user) {
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
                    // Same generic message to prevent user enumeration
                    throw new Error('Thông tin đăng nhập không chính xác');
                }

                // Skip email verification check for admin
                if (user.role !== 'admin' && !user.email_verified) {
                    throw new Error('Email chưa được xác thực. Vui lòng kiểm tra hộp thư.');
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
