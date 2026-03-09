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
- **Completed**: Core dependencies, shadcn/ui components, TanStack Query, next-themes, theme-aware styling across all pages, global error handling, API status page, loading states, TypeScript clean (0 errors), security audit fixes applied
- **Blocked**: Prisma schema (needs direct Supabase connection URL, not pooler), repository migration (depends on Prisma)
- **Not yet configured**: Stripe secrets, Upstash Redis secrets

## Testing & Validation
- **TypeScript**: 0 errors (all variant="primary" fixed to "default", case-sensitivity conflicts resolved)
- **Security**: Cleanup API route secured with admin auth + cron secret, CSRF protection on mutations, rate limiting on sensitive routes, file validation with magic bytes, admin 2FA enforced
- **Imports**: All PascalCase duplicate UI files removed (9 files), custom components renamed to custom-*.tsx to avoid case conflicts
- **Runtime**: No console errors, all API routes returning correct status codes, health endpoint working
- **E2E Tested Flows (all 3 order types)**:
  - Product Order: Browse → Cart → Checkout → Create order (multiple items/sizes) → Admin confirm/process/ship ✅
  - 3D Printing Order: Create with full spec (resin/trắng, infill 20%, layer 0.08mm, 2 STL files) → Admin views print_jobs with material/color/grams/hours ✅
  - Custom Order: Create couple figurine (size M, 2 characters with glasses/hat descriptions, 4 reference images) → Admin views custom_config with character details ✅
  - Admin Workflow: Confirm payment → Processing/Designing → Shipping (with tracking code) → Stock adjustment ✅
  - Customer: View all orders (product/custom/print_3d) with correct status ✅
  - API Security: All admin APIs return 401 without auth, cleanup route secured ✅
  - Public pages: FAQ, About, Register, Forgot Password, 404, Theme toggle ✅
- **Bug Fixes Found During E2E**:
  - Fixed `file_links(*)` join in OrderRepository.ts — `file_links` uses polymorphic ref_id/ref_type (not FK), causing PGRST200 errors on customer order listing
  - Fixed `product_name` → `name` column reference in AdminOrderController.ts stock adjustment code
  - Fixed shipping address persistence: `OrderRepository.create` now falls back to `shippingAddress` if `shippingAddressSnapshot` is not set
  - Fixed 2FA fail-open security: `admin-guard.ts` now denies access if 2FA check encounters DB errors (was previously fail-open)
- **Test Accounts**: Admin (picapica10104@gmail.com) and Customer (ngynhaatminh@gmail.com) — passwords stored in Supabase

## UI Component Convention
- **shadcn/ui** (lowercase): `button.tsx`, `card.tsx`, `input.tsx`, etc. — standard shadcn components
- **Custom** (renamed): `custom-input.tsx`, `custom-skeleton.tsx`, `custom-switch.tsx` — project-specific components with extra features (e.g. ProductGridSkeleton, label/error support)
- **Custom** (PascalCase, unique): `Animations.tsx`, `GlassCard.tsx`, `VersionFeedbackCard.tsx`, `FloatingDock.tsx`, etc.
- **Barrel export**: `src/components/ui/index.ts` re-exports all components correctly

## Notes
- GOOGLE_PRIVATE_KEY was truncated during migration — needs to be re-added with the full key
- Stripe and Upstash Redis secrets are not yet configured
- WebGL/Three.js content won't render in headless environments but works in real browsers
- Admin route (`/admin/`) re-exports from `/sys_internal/` — actual admin code lives in `src/app/sys_internal/`
