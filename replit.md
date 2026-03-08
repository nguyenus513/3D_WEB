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
- **Styling**: Tailwind CSS v3 + shadcn/ui + Framer Motion + GSAP
- **State Management**: TanStack Query (React Query) for server state
- **Theme**: next-themes with data-theme attribute (dark/light)
- **UI Components**: shadcn/ui (lowercase in src/components/ui/)

## Design System
- **Theme Provider**: next-themes with `attribute="data-theme"`
- **Dark Mode**: `tailwind.config.ts` uses `darkMode: ['selector', '[data-theme="dark"]']`
- **CSS Variables**: Defined in `src/app/globals.css` with `[data-theme="light"]` / `[data-theme="dark"]` selectors
  - `--bg-void`: Page backgrounds
  - `--material-panel`: Card/panel backgrounds
  - `--material-glass`: Glass/transparent overlays
  - `--text-primary`, `--text-secondary`, `--text-tertiary`: Text hierarchy
  - `--border-color`: Border colors
  - `--color-accent`: Accent/action color (#0071E3)
- **Components**: 23 shadcn/ui components (button, card, input, label, dialog, dropdown-menu, select, tabs, badge, avatar, separator, skeleton, table, textarea, tooltip, switch, checkbox, scroll-area, sheet, progress, accordion, popover, theme-toggle)

## Project Structure
```
src/
  app/           # Next.js App Router pages and API routes
    api/health/  # Health check endpoint
    status/      # System status page
    error.tsx    # Global error boundary
    not-found.tsx # 404 page
    loading.tsx  # Root loading state
  components/
    ui/          # shadcn/ui components (lowercase)
    providers/   # ThemeProvider, QueryProvider
    layout/      # NavLusion, Footer, Navbar
    admin/       # Admin components (sidebar, header, etc.)
    account/     # Account sidebar
    checkout/    # Checkout components
    user/        # Landing page components (HeroJelly, BentoGrid, etc.)
  controllers/   # Business logic controllers
  hooks/         # Custom React hooks
  lib/
    api/         # API error handler utility
    utils.ts     # cn() utility for class merging
  repositories/  # Data access layer (Supabase client)
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

## Modernization Status
- **Completed**: Core dependencies, shadcn/ui components, TanStack Query, next-themes, theme-aware styling across all pages, global error handling, API status page, loading states
- **Blocked**: Prisma schema (needs direct Supabase connection URL, not pooler), repository migration (depends on Prisma)
- **Not yet configured**: Stripe secrets, Upstash Redis secrets

## Notes
- GOOGLE_PRIVATE_KEY was truncated during migration — needs to be re-added with the full key
- Stripe and Upstash Redis secrets are not yet configured
- WebGL/Three.js content won't render in headless environments but works in real browsers
- Admin route (`/admin/`) re-exports from `/sys_internal/` — actual admin code lives in `src/app/sys_internal/`
- Old PascalCase UI components coexist with new lowercase shadcn/ui components — pages have been migrated to use lowercase imports
