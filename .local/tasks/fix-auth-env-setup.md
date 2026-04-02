# Fix Auth Module + Configure Secrets

## What & Why

Two related issues are causing API routes to return HTML error pages instead of JSON, breaking the featured-products component and NextAuth session checks:

1. **Code bug**: `src/auth.ts` calls `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)` directly at module evaluation time. It bypasses `unifiedConfig`, which already provides dev-safe placeholder fallbacks. When those env vars are absent, the module throws `supabaseUrl is required` on load, crashing every route that imports `auth` (including `admin-guard` → `ProductController` → `/api/featured-products`). Next.js returns an HTML 500 page and the client gets a `SyntaxError` trying to parse it as JSON.

2. **Missing secrets**: `AUTH_SECRET` (required by NextAuth v5) and the three Supabase variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are not set as Replit Secrets.

## Done looks like

- Dev server logs show no `supabaseUrl is required` module-load error on any route
- `GET /api/featured-products` returns HTTP 200 with valid JSON (no HTML 500)
- `GET /api/auth/session` returns HTTP 200 with a valid JSON session object
- Browser console no longer shows `ClientFetchError` or `SyntaxError` JSON-parse errors
- `AUTH_SECRET` is stored as a Replit Secret (32+ char random value)
- Supabase credentials are stored as Replit Secrets

## Out of scope

- Wiring up full Supabase database tables or running migrations
- Stripe, email, or other optional service credentials

## Tasks

1. **Fix auth.ts Supabase client creation** — Replace the two direct `process.env.*` references in `src/auth.ts` (lines 22-25) with `config.supabase.url` and `config.supabase.serviceRoleKey` from `@/config/unifiedConfig`. This makes the module load safely in dev even without real credentials by using the existing placeholder fallbacks.

2. **Generate and store AUTH_SECRET** — Generate a cryptographically random 32+ character string and store it as a Replit Secret named `AUTH_SECRET`. This resolves the `[MIDDLEWARE ERROR] No AUTH_SECRET or NEXTAUTH_SECRET found` warning.

3. **Prompt for and store Supabase credentials** — Use the Replit Secrets manager to request the user's Supabase project URL, anon key, and service role key, then store them as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Instruct the user to find these under Project Settings → API in their Supabase dashboard.

4. **Verify fixes** — Restart the dev server and confirm: no HTML 500 on `/api/featured-products`, no `ClientFetchError` in browser console, and no `supabaseUrl is required` in server logs.

## Relevant files

- `src/auth.ts:20-26`
- `src/config/unifiedConfig.ts:92-119`
- `src/lib/security/admin-guard.ts:9`
- `src/app/api/featured-products/route.ts`
- `src/components/user/FeaturedProducts.tsx:30-40`
