# Security Best Practices Report

## Executive Summary
The codebase already includes solid security building blocks (rate limiting middleware, sanitized inputs, and a CSRF utility), but there are several gaps that could weaken production security at scale. The most urgent items are a credentialed CORS configuration that can fall back to wildcard origins, and a lack of CSRF enforcement on state-changing endpoints. There are also CSP relaxations and a direct DOM sink that should be tightened for stronger XSS defense-in-depth.

## High Severity Findings

### 1) Credentialed CORS Falls Back to Wildcard Origin
- Rule ID: NEXT-CORS-001
- Severity: High
- Location: `next.config.ts:70-76`
- Evidence:
  ```ts
  { key: 'Access-Control-Allow-Credentials', value: 'true' },
  { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_APP_URL || '*' },
  ```
- Impact: If `NEXT_PUBLIC_APP_URL` is unset or misconfigured, the server emits `Access-Control-Allow-Origin: *` while also allowing credentials. This is an unsafe CORS posture and can either create a security risk (if a proxy rewrites origins) or break authenticated API calls unexpectedly.
- Fix: Only allow explicit, validated origins for credentialed requests. Either remove CORS for same-origin APIs, or dynamically reflect the request origin after checking against an allowlist.
- Mitigation: Add a hard startup validation that fails if `NEXT_PUBLIC_APP_URL` is missing in production.
- False positive notes: If CORS is never relied on (same-origin only), the risk is mainly misconfiguration and should still be fixed to avoid future expansion issues.

### 2) CSRF Not Enforced on State-Changing Route Handlers
- Rule ID: NEXT-CSRF-001
- Severity: High
- Location: `src/app/api/orders/create/route.ts:30-58`
- Evidence:
  ```ts
  export async function POST(request: NextRequest) {
      // Verify auth
      const session = await auth();
      ...
      const body: CreateOrderRequest = await request.json();
  }
  ```
- Impact: If auth relies on cookies, state-changing routes without CSRF validation can be triggered by a malicious third-party site, potentially creating orders or mutating user state.
- Fix: Require CSRF validation for all POST/PUT/PATCH/DELETE endpoints that use cookie-based auth. You already have `requireCsrf` in `src/lib/security/csrf.ts:86-106`; add it at the start of these handlers and return the error response on failure.
- Mitigation: As an interim defense, enforce SameSite=strict cookies and verify `Origin`/`Referer` for same-site requests.
- False positive notes: If every state-changing endpoint uses bearer-token auth only (no cookies), CSRF impact is reduced. Verify the auth transport.

## Medium Severity Findings

### 3) CSP Allows `unsafe-inline` and `unsafe-eval`
- Rule ID: NEXT-CSP-001
- Severity: Medium
- Location: `next.config.ts:40-44`
- Evidence:
  ```ts
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
  ```
- Impact: `unsafe-eval` and inline scripts significantly weaken CSP protection against XSS. If any XSS issue is introduced, CSP will not meaningfully reduce exploitability.
- Fix: Remove `unsafe-eval` in production and move to nonces/hashes for inline scripts. Audit any libraries (analytics/3D libs) that require eval and provide safer alternatives.
- Mitigation: If removal is not immediately possible, scope a strict allowlist for inline usage and add CSP reports to detect violations.
- False positive notes: If `unsafe-eval` is required by a specific runtime, document why and confine it to the minimum environments.

## Low Severity / Informational Findings

### 4) Direct DOM `innerHTML` Usage in Admin Page
- Rule ID: FRONTEND-DOMXSS-001
- Severity: Low
- Location: `src/app/sys_internal/orders/[id]/page.tsx:961-963`
- Evidence:
  ```ts
  e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full ... </div>';
  ```
- Impact: Direct HTML injection is a DOM XSS sink. While this string is static and currently safe, it creates a risky pattern and future edits might accidentally introduce untrusted data.
- Fix: Replace with state-driven rendering instead of injecting HTML. For example, set a boolean flag on error and render the fallback via JSX.
- Mitigation: If this must remain, ensure only static strings and never interpolate variables.
- False positive notes: This is currently static HTML, so exploitability is low; the risk is future maintenance.

### 5) JSON-LD Uses `dangerouslySetInnerHTML`
- Rule ID: REACT-XSS-INFO-001
- Severity: Low (Informational)
- Location: `src/components/seo/ProductSchema.tsx:53-56`, `79-83`, `111-114`
- Evidence:
  ```ts
  dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
  ```
- Impact: JSON-LD injection is commonly acceptable, but it relies on ensuring `schema` only contains safe, controlled data. If user-supplied values are inserted without sanitization, XSS risks rise.
- Fix: Keep schema fields controlled or sanitize any user-provided values before serialization.
- Mitigation: Consider freezing allowed fields and validating with a schema.
- False positive notes: If all values are static or server-controlled, this is safe.

---

## Notes
- A CSRF utility already exists in `src/lib/security/csrf.ts:86-106`. The main gap is enforcement across API routes.
- Security headers are otherwise well defined, and rate limiting is already present in `middleware.ts`.
