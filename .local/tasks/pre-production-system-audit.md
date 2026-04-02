# Pre-Production System Audit & Fix

## What & Why
A full end-to-end audit and bug-fix pass covering every part of the application before it goes live in production. This includes fixing confirmed known bugs (double eye icon on password fields, duplicate UI components) and systematically checking every user-facing and admin-facing flow for correctness, security, and UX quality.

## Done looks like
- **Password fields** — Register page shows exactly one eye toggle icon per password field (using consistent lucide-react Eye/EyeOff, browser native icon suppressed with CSS), matching the login page style
- **Auth flows** — Login (email + Google OAuth), register (multi-step + OTP), forgot password, and reset password all complete without errors end-to-end
- **User flows** — Browse home → product list → product detail → add to cart → checkout (with address, payment QR/Stripe) → order confirmation page all function correctly; account pages (profile, orders, addresses, wishlist) load and update data
- **Custom/printing flows** — Upload STL/OBJ on `/printing`, receive AI analysis result; upload reference image on `/custom/create`, receive AI accessory suggestions; submit order — all work without errors
- **Admin flows** — Admin dashboard, product/category management (create/edit/delete), customer list, revenue stats, order management (accept/reject/status update), 3D print queue, settings — all operational
- **Order image confirmation** — Admin can open a custom order, view customer-uploaded images, and update order status
- **Security** — Rate limiting on auth endpoints is active; CSRF protection on forms is active; admin 2FA checkpoint works; file upload validation rejects disallowed file types; no sensitive data exposed in client-side JS or API responses
- **Storage** — File uploads land in Supabase Storage (or R2 fallback); no broken image URLs in product pages or order detail pages; Google Drive sync endpoint accessible
- **Duplicate UI** — No duplicate components render on the same page (confirmed no double navbars, double footers, double modals); no duplicate CSS utility classes producing invisible elements
- **Error states** — All pages show a graceful error/empty state rather than crashing when API calls fail (404, 500 scenarios handled)
- **Production readiness** — All required environment variables documented and confirmed set; no hardcoded localhost URLs; `next.config.ts` has correct image domains and CSP headers; Sentry error tracking initialised correctly

## Out of scope
- Writing automated test suites or CI pipelines
- New features or redesigns
- Database schema migrations
- Third-party payment provider configuration (Stripe keys, VietQR bank config) — those require the user to supply credentials

## Tasks

1. **Fix double eye icon on password fields** — On the register page, the password field shows both a custom emoji toggle button and the browser's native password reveal icon simultaneously. Replace the emoji toggle with lucide-react `Eye`/`EyeOff` icons (matching login page), add CSS to suppress the browser-native icon (`input[type="password"]::-ms-reveal`, `input[type="password"]::-webkit-credentials-auto-fill-button { display: none }`), and add a matching show/hide toggle to the confirm-password field so both fields behave consistently.

2. **Audit and fix all auth flows** — Manually trace the login (email/password + Google OAuth), multi-step register (OTP email verification), forgot-password email send, and reset-password token validation flows. Fix any broken API calls, missing redirects, or unclear error messages discovered during the trace. Verify that the middleware correctly protects authenticated routes and redirects unauthenticated users.

3. **Audit and fix user-facing product & cart flows** — Check the home page (featured products, hero), product list, product detail, cart add/remove/update, and checkout (address picker, payment method selection, order submission). Fix any 500 errors, broken images, or UX problems found (e.g., empty states missing, loading spinners not shown).

4. **Audit and fix the custom order & printing flows** — On `/custom/create`, verify image upload → AI accessory analysis → form fill → order submission works end-to-end. On `/printing`, verify STL/OBJ upload → mesh AI analysis (with worker or server fallback) → price/time estimate display → order submission. Fix any broken steps.

5. **Audit and fix account pages** — Check profile view/edit, order history list and order detail (including image viewing), address management (add/edit/delete), and wishlist. Fix any data-loading errors or missing UI states.

6. **Audit and fix all admin flows** — Check the admin dashboard, product CRUD, category CRUD, customer list + detail, revenue stats, product order management, custom order management (including image review and status updates), 3D print queue, and admin settings. Fix broken pages, missing data, or incorrect permission checks.

7. **Security audit** — Verify rate limiting headers on `/api/auth/register` and `/api/auth/signin`; confirm CSRF token is validated on all mutation endpoints; confirm admin 2FA is enforced when accessing `/admin`; confirm file upload endpoints reject non-allowed MIME types and oversized files; check that API responses don't leak internal error details (stack traces) to the client in production mode.

8. **Storage & file URL audit** — Verify uploaded product images, custom order images, and STL files resolve correctly from their stored URLs. Confirm R2 fallback works if Supabase Storage is unavailable. Check that presigned upload URLs (`/api/uploads/presign`) and completion callbacks (`/api/uploads/complete`) function correctly end-to-end.

9. **Duplicate UI component sweep** — Walk every page (user and admin) looking for double navbars, double footers, duplicate modals, or duplicate form elements rendered simultaneously. Check that `NavbarLusion` (flagged as dead code in Task #6) is gone and no page renders two navigation bars. Fix any found duplicates.

10. **Production readiness check & fixes** — Verify all environment variable names match what the code reads (`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_*`, `CLOUDFLARE_*`, `UPSTASH_*`, `SENTRY_*`, etc.). Replace any hardcoded `localhost` URLs. Confirm `next.config.ts` lists all external image domains. Confirm Sentry is capturing errors in both client and server configs. Confirm `vercel.json` (or deployment config) has the correct build command and output directory.

## Relevant files
- `src/app/register/page.tsx:555-592`
- `src/app/login/page.tsx`
- `src/app/forgot-password/page.tsx`
- `src/app/reset-password/page.tsx`
- `src/app/page.tsx`
- `src/app/products/[id]/page.tsx`
- `src/app/cart/page.tsx`
- `src/app/checkout/page.tsx`
- `src/app/custom/page.tsx`
- `src/app/printing/page.tsx`
- `src/app/account/page.tsx`
- `src/app/account/orders/[id]/page.tsx`
- `src/app/account/addresses`
- `src/app/account/wishlist`
- `src/app/admin/page.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/orders/page.tsx`
- `src/app/admin/orders/custom`
- `src/app/admin/printing/page.tsx`
- `src/app/admin/products`
- `src/app/admin/settings/page.tsx`
- `src/app/admin/verify-2fa`
- `src/app/api/uploads/presign/route.ts`
- `src/app/api/uploads/complete/route.ts`
- `src/app/api/analyze-stl/route.ts`
- `src/app/api/webhooks/qr/route.ts`
- `src/app/api/payment/webhook/route.ts`
- `src/middleware.ts`
- `src/controllers/AuthController.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/security/SecurityLogger.ts`
- `src/config/unifiedConfig.ts`
- `src/components/layout/LayoutWrapper.tsx`
- `src/components/layout/NavLusion.tsx`
- `next.config.ts`
- `vercel.json`
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
