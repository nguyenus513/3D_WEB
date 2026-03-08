# Miniver 3D Lab

## Overview
A Next.js 16 e-commerce/3D printing service application migrated from Vercel to Replit. Vietnamese-language UI with features including product catalog, user auth (Google OAuth via NextAuth), Supabase backend, Stripe payments, Cloudflare R2 storage, and Google Drive integration.

## Architecture
- **Framework**: Next.js 16.1.1 with Turbopack, App Router (`src/app/`)
- **Auth**: NextAuth v5 (beta) with Google OAuth + Supabase adapter
- **Database**: Supabase (PostgreSQL via pooler)
- **Storage**: Cloudflare R2 (primary), Google Drive (archive)
- **Payments**: Stripe
- **Cache**: Upstash Redis (optional)
- **Monitoring**: Sentry (client + server + edge)
- **3D Rendering**: Three.js via @react-three/fiber
- **Styling**: Tailwind CSS v3 + Framer Motion + GSAP

## Project Structure
```
src/
  app/           # Next.js App Router pages and API routes
  components/    # React components
  controllers/   # Business logic controllers
  hooks/         # Custom React hooks
  lib/           # Shared utilities and configs
  repositories/  # Data access layer
  services/      # Service layer
  styles/        # Global styles
  types/         # TypeScript type definitions
  validators/    # Input validation (Zod)
  auth.ts        # NextAuth configuration
  proxy.ts       # Proxy/middleware utilities
  config/        # App configuration
middleware.ts    # Next.js middleware (root)
next.config.ts   # Next.js configuration
```

## Replit-Specific Configuration
- **Port**: 5000 (bound to 0.0.0.0)
- **Dev command**: `next dev -p 5000 -H 0.0.0.0`
- **allowedDevOrigins**: Configured for Replit's dev domain
- **CSP frame-ancestors**: Updated to allow Replit's iframe preview
- **X-Frame-Options**: Set to allow Replit dev/app domains

## Environment Variables
All secrets are configured in Replit's environment. Key groups:
- **Supabase**: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
- **Auth**: AUTH_SECRET, NEXTAUTH_SECRET, AUTH_URL, NEXTAUTH_URL, AUTH_TRUST_HOST, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- **Google Services**: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY (needs full key), GOOGLE_DRIVE_FOLDER_ID, GOOGLE_OAUTH_CLIENT_ID/SECRET
- **Storage**: CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
- **Email**: GMAIL_USER, GMAIL_APP_PASSWORD, BREVO_API_KEY
- **Payments**: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (not yet provided)
- **Cache**: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (not yet provided)
- **Security**: TOKEN_ENCRYPTION_KEY, ADMIN_SECRET_KEY

## Notes
- GOOGLE_PRIVATE_KEY was truncated during migration — needs to be re-added with the full key
- Stripe and Upstash Redis secrets are not yet configured
- WebGL/Three.js content won't render in headless environments but works in real browsers
