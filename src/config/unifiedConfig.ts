/**
 * Unified Configuration Module
 *
 * Centralizes all environment variables with Zod validation.
 * App will fail fast at startup if required env vars are missing.
 *
 * @see backend-dev-guidelines.md - Rule #4: Use unifiedConfig, NEVER process.env
 */

import { z } from 'zod';

// =============================================================================
// Environment Schema Definition
// =============================================================================

const envSchema = z.object({
    // Supabase (Required)
    NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

    // NextAuth (Optional - uses defaults if not set)
    NEXTAUTH_URL: z.string().url().optional().default('http://localhost:3000'),
    NEXTAUTH_SECRET: z.string().min(32).optional().default('default-dev-secret-must-be-at-least-32-chars'),

    // Cloudflare R2 Storage (Optional in dev)
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET_NAME: z.string().optional(),
    NEXT_PUBLIC_R2_PUBLIC_URL: z.string().url().optional(),
    R2_ENDPOINT: z.string().url().optional(),

    // Google Drive (Optional)
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().url().optional(),
    GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),

    // Email (Optional in dev)
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().email().optional(),

    // Resend (Alternative email)
    RESEND_API_KEY: z.string().optional(),

    // Payment/Bank
    BANK_NAME: z.string().optional(),
    BANK_ACCOUNT_NUMBER: z.string().optional(),
    BANK_ACCOUNT_NAME: z.string().optional(),
    BANK_TCB_ACCOUNT_NO: z.string().optional(),
    BANK_TCB_ACCOUNT_NAME: z.string().optional(),
    BANK_STB_ACCOUNT_NO: z.string().optional(),
    BANK_STB_ACCOUNT_NAME: z.string().optional(),

    // Security
    RATE_LIMIT_LOGIN: z.coerce.number().default(5),
    RATE_LIMIT_REGISTER: z.coerce.number().default(3),
    JWT_SECRET: z.string().optional(),
    REFRESH_TOKEN_SECRET: z.string().optional(),

    // Monitoring (Sentry)
    SENTRY_DSN: z.string().url().optional().or(z.literal('')),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),

    // Redis (Upstash)
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

    // Admin
    ADMIN_EMAILS: z.string().optional(),

    // App
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

// =============================================================================
// Parse and Validate Environment
// =============================================================================

function getEnvIssueMessage(issues: z.ZodIssue[]): string {
    return issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
}

function parseEnv() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const message = `\n❌ Invalid environment variables:\n${getEnvIssueMessage(result.error.issues)}\n`;

        // In production, throw immediately to fail fast
        if (process.env.NODE_ENV === 'production') {
            throw new Error(message);
        }

        // In development, log warning but continue (for easier local dev)
        console.error(message);

        // Return partial config with defaults for dev
        return envSchema.parse({
            ...process.env,
            // Provide fallbacks for required fields in dev
            NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder',
            NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
            NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'dev-secret-must-be-at-least-32-chars',
        });
    }

    return result.data;
}

const env = parseEnv();

// =============================================================================
// Typed Configuration Object
// =============================================================================

export const config = {
    /**
     * Environment mode
     */
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',

    /**
     * Application URLs
     */
    app: {
        url: env.NEXT_PUBLIC_APP_URL || env.NEXTAUTH_URL,
    },

    /**
     * Supabase Configuration
     */
    supabase: {
        url: env.NEXT_PUBLIC_SUPABASE_URL,
        anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    },

    /**
     * NextAuth Configuration
     */
    auth: {
        url: env.NEXTAUTH_URL,
        secret: env.NEXTAUTH_SECRET,
        jwtSecret: env.JWT_SECRET,
        refreshTokenSecret: env.REFRESH_TOKEN_SECRET,
    },

    /**
     * Cloudflare R2 Storage
     */
    storage: {
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucketName: env.R2_BUCKET_NAME,
        publicUrl: env.NEXT_PUBLIC_R2_PUBLIC_URL,
        endpoint: env.R2_ENDPOINT,
        isConfigured: Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID),
    },

    /**
     * Google Drive Integration
     */
    googleDrive: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: env.GOOGLE_REDIRECT_URI,
        folderId: env.GOOGLE_DRIVE_FOLDER_ID,
        isConfigured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    },

    /**
     * Email Configuration
     */
    email: {
        smtp: {
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
        },
        from: env.EMAIL_FROM,
        resendApiKey: env.RESEND_API_KEY,
        isConfigured: Boolean(env.RESEND_API_KEY || (env.SMTP_HOST && env.SMTP_USER)),
    },

    /**
     * Payment/Bank Configuration
     */
    payment: {
        bank: {
            name: env.BANK_NAME,
            accountNumber: env.BANK_ACCOUNT_NUMBER,
            accountName: env.BANK_ACCOUNT_NAME,
        },
        tcb: {
            accountNo: env.BANK_TCB_ACCOUNT_NO,
            accountName: env.BANK_TCB_ACCOUNT_NAME,
        },
        stb: {
            accountNo: env.BANK_STB_ACCOUNT_NO,
            accountName: env.BANK_STB_ACCOUNT_NAME,
        },
    },

    /**
     * Security Settings
     */
    security: {
        rateLimits: {
            login: env.RATE_LIMIT_LOGIN,
            register: env.RATE_LIMIT_REGISTER,
        },
    },

    /**
     * Monitoring (Sentry)
     */
    sentry: {
        dsn: env.SENTRY_DSN,
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        isConfigured: Boolean(env.SENTRY_DSN),
    },

    /**
     * Redis (Upstash)
     */
    redis: {
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
        isConfigured: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
    },

    /**
     * Admin Configuration
     */
    admin: {
        emails: env.ADMIN_EMAILS?.split(',').map((e) => e.trim()) || [],
    },
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type Config = typeof config;
export type EnvSchema = z.infer<typeof envSchema>;
