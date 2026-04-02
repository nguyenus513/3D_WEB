/**
 * Edge-compatible NextAuth configuration.
 *
 * This file contains ONLY Edge Runtime-safe code (no Node.js-only modules).
 * It is used exclusively by middleware.ts to decode the JWT session cookie
 * and build the session object without running provider-specific logic.
 *
 * The full configuration (with Credentials/Google providers, bcrypt, Supabase,
 * brute-force protection, etc.) lives in src/auth.ts and is used by all
 * server-side routes. Both configurations share the same AUTH_SECRET so they
 * encode/decode the same JWT tokens.
 */

import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
    session: {
        strategy: 'jwt',
        maxAge: 86400,
    },
    pages: {
        signIn: '/login',
        newUser: '/register',
        error: '/login',
    },
    providers: [],
    callbacks: {
        /**
         * Map JWT payload fields into the session so that req.auth.user.role
         * and req.auth.user.isNewUser are available in middleware.
         * The JWT itself is written by the full JWT callback in src/auth.ts.
         */
        session({ session, token }) {
            if (session.user) {
                (session.user as Record<string, unknown>).id = token.id ?? token.sub;
                (session.user as Record<string, unknown>).role = token.role;
                (session.user as Record<string, unknown>).isNewUser = token.isNewUser;
                (session.user as Record<string, unknown>).customerCode = token.customerCode;
            }
            return session;
        },
    },
};
