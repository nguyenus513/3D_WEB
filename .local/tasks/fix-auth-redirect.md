# Fix Auth Redirect — Admin/User Role Confusion

## What & Why

Three related bugs cause admin users to land on customer-facing pages:

**Bug A — Middleware has no admin-to-customer guard.**
`middleware.ts` uses `getToken()` from `next-auth/jwt` (NextAuth v4 API).
NextAuth v5 (currently `^5.0.0-beta.30`) changed the JWT token encoding and the
recommended middleware pattern is to wrap the `auth()` export, not call `getToken`
directly. In the Edge Runtime this can cause intermittent token read failures where
`getToken` returns `null` (wrong cookie name, different salt). When that happens,
middleware treats the admin as unauthenticated on an admin route → redirects to
`/login?callbackUrl=...` → after re-login the callbackUrl is `/sys_internal` so they
land there correctly, BUT if role in cookie is somehow unreadable, the admin falls
through to `/?error=unauthorized` (the homepage = "trang user").

**Bug B — Middleware allows admins onto customer pages.**
`/account/*` and `/checkout/*` are declared as `PROTECTED_ROUTES` which only blocks
*unauthenticated* users. There is no rule to redirect an *authenticated admin* back
to the admin panel. So if an admin reaches `/account` (e.g. via `useTwoFAGate`
redirect chain, or by typing the URL), they see the customer account UI while still
authenticated as admin.

**Bug C — Customer login callbackUrl loop.**
After sign-out the customer is redirected to `/login?callbackUrl=%2Faccount`. In the
login page, if the redirect chain ever produces `callbackUrl=/login`, the customer is
sent back to `/login` after signing in (infinite loop). The login page should
sanitise the callbackUrl — if it points to `/login` or `/register`, fall back to
`/account`.

## Done looks like

- Admin reloads any `/sys_internal/*` page → stays on the same admin page, no
  redirect to homepage or customer pages.
- If an admin somehow lands on `/account`, they are immediately redirected to
  `/sys_internal` instead of seeing the customer account page.
- Customer logs in → always lands on `/account` (or valid callbackUrl), never
  redirected back to `/login`.
- Middleware correctly reads the NextAuth v5 JWT token on every request in the
  Edge Runtime.

## Out of scope

- Any 2FA flow changes.
- Google OAuth sign-in flow changes.
- Any visual / UI changes.

## Tasks

1. **Migrate middleware from `getToken` to NextAuth v5 `auth()` wrapper.**
   Replace `getToken({ req, secret })` with the v5 pattern:
   `export default auth(async (req) => { ... })` using the `auth` export from
   `@/auth`. Preserve all existing redirect rules. This eliminates the Edge Runtime
   token-reading incompatibility.

2. **Add admin-to-customer redirect guard in middleware.**
   Inside the middleware handler, before the existing `PROTECTED_ROUTES` check, add:
   if the token has `role === 'admin'` and the path starts with `/account` or
   `/checkout`, redirect to `/sys_internal`. This prevents admins from ever landing
   on customer-facing pages.

3. **Fix login page callbackUrl sanitisation.**
   In `src/app/login/page.tsx`, after reading `callbackUrl` from searchParams, add a
   guard: if it equals `/login` or `/register` (or is empty), replace with
   `/account`. This stops the infinite login loop for customers.

## Relevant files

- `middleware.ts`
- `src/auth.ts`
- `src/app/login/page.tsx:43-144`
