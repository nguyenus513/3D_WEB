# Project Overview

A Next.js 16 (App Router) e-commerce/print-on-demand application migrated from Vercel to Replit. Uses React 19, TypeScript, Tailwind CSS, Supabase, NextAuth v5, Stripe, AWS S3/R2, Sentry, and Upstash Redis.

## Architecture

- **Framework**: Next.js 16.1.1 with App Router (`src/app/`)
- **Auth**: NextAuth v5 (beta) with Supabase adapter, JWT sessions
- **Database**: Supabase (PostgreSQL) + direct `pg` connections
- **Storage**: Cloudflare R2 (S3-compatible) for file uploads
- **Payments**: Stripe
- **Email**: Nodemailer (Gmail) + Brevo API
- **Cache/Rate limiting**: Upstash Redis
- **Monitoring**: Sentry
- **Styling**: Tailwind CSS v3 + Framer Motion + GSAP + Three.js
- **Client-side AI**: XGBoost JSON inference in Web Worker (Phase 1), MobileCLIP zero-shot classification via Transformers.js (Phase 3)

## Client-Side AI (src/lib/ai/)

### Phase 1 — 3D Print quoting (PrusaSlicer backend + XGBoost AI assist)
- **PrusaSlicer 2.9.2** installed via Nix at `/nix/store/.../prusa-slicer-2.9.2/bin/prusa-slicer`
- `src/lib/slicer/types.ts` — shared types: `SlicerConfig`, `FdmSlicerResult`, `ResinSlicerResult`, `QuoteResult`, `JobStatus`
- `src/lib/slicer/profiles.ts` — profile registry mapping profileId → INI path + defaults
- `src/lib/slicer/slicerRunner.ts` — spawns PrusaSlicer CLI, parses bbox/volume from stdout, returns G-code buffer
- `src/lib/slicer/outputParser.ts` — G-code parser for FDM (filament g, print time, layer count) + resin geometry calc
- `src/lib/slicer/priceEngine.ts` — VND pricing: PLA 500/g, PETG 550/g, FDM machine 35,000/h; resin 3,500/ml, SLA machine 45,000/h
- `src/lib/slicer/slicerCache.ts` — SHA256 content-addressed in-memory cache (24h TTL)
- `src/lib/slicer/jobQueue.ts` — async in-memory job queue (1h TTL, status: queued/running/completed/failed)
- `printer-profiles/fdm/fdm_pla_standard.ini` + `fdm_petg_standard.ini` — FDM INI profiles (Bambu Lab A1, 256×256×256mm)
- `printer-profiles/resin/resin_standard_detail.ini` + `resin_fast.ini` — Resin SLA INI profiles (ELEGOO Mars 5 Ultra, 153.36×77.76×165mm)
- `src/app/api/printing/exact-quote/route.ts` — POST: accepts `.3mf` multipart only → returns jobId or cached result
- `src/app/api/printing/quote-status/route.ts` — GET: jobId → status/result polling
- `src/app/api/analyze-stl/route.ts` — now returns only volume/bbox/triangleCount (pricing removed, handled by slicer backend)
- Client-side AI (XGBoost) retained for: **risk detection**, **orientation hints**, **preset recommendations**
- `types/print-ai.ts` — shared TypeScript interfaces (MeshFeatures, PrintAIResult, RiskLevel, Worker message types)
- `runtime/deviceTier.ts` — device capability detection (high/mid/low)
- `features/meshFeatures.ts` — client-side STL/OBJ parser + 13-feature extractor
- `models/xgbRunner.ts` — XGBoost JSON tree ensemble runner (regression + OvR classification)
- `workers/mesh-ai.worker.ts` — Web Worker: parses mesh + runs XGBoost inference off main thread
- `public/models/` — 5 trained models: quote_xgb.json, time_xgb.json, risk_xgb_0/1/2.json (~367KB total)
- `scripts/generate_print_models.js` — Node.js model training script (800 synthetic samples, seeded PRNG)

### Phase 3 — Custom figurine accessory detection (MobileCLIP zero-shot)
- `types/custom-ai.ts` — TypeScript interfaces (AccessoryPrediction with `propsDescription`, worker request/response with `imageUrl`)
- `workers/image-ai.worker.ts` — Web Worker: Xenova/mobileclip_s0 via Transformers.js; lazy-loads on first message; pre-computes text embeddings for 10 labels; per-category softmax; dtype q8 WASM
- Label groups (per-category softmax, independent detection):
    - Glasses: round / square / sunglasses → Vietnamese
    - Hat: baseball cap / bucket / graduation → Vietnamese
    - Props: bouquet / book / guitar → Vietnamese (new in Phase 3)
- `/custom` page: upload → imageUrl sent directly to worker → analyzing badge → dirty-flag user-override safety → AI autofill glasses/hat/props fields
- Props chip: read-only, clearable, shown in accessory panel + StepConfirm; included in submit payload
- CSP updated with HuggingFace CDN domains in connect-src
- Dependency: `@huggingface/transformers@^4.0.0`

## Key Directories

- `src/app/` — Next.js App Router pages and API routes
- `src/components/` — Shared React components
- `src/lib/` — Utilities, DB clients, auth config
- `src/services/` — Business logic layer
- `src/repositories/` — Data access layer
- `src/validators/` — Zod validation schemas
- `middleware.ts` — Edge middleware for route protection (auth/admin guards)

## Running the App

```bash
npm run dev   # dev server on port 5000
npm run build # production build
npm start     # production server on port 5000
```

The workflow "Start application" runs `npm run dev` on port 5000.

## Required Environment Variables

### Auth
- `AUTH_SECRET` or `NEXTAUTH_SECRET` — NextAuth JWT signing secret
- `NEXTAUTH_URL` — Full URL of the app (e.g. https://your-repl.replit.app)
- `NEXT_PUBLIC_APP_URL` — Same as NEXTAUTH_URL (used for CORS)

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` — PostgreSQL connection string (pooled)
- `DIRECT_URL` — PostgreSQL direct connection string

### Stripe
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Cloudflare R2 (S3-compatible storage)
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_ENDPOINT`
- `R2_PUBLIC_URL`
- `NEXT_PUBLIC_R2_PUBLIC_URL`
- `CLOUDFLARE_ACCOUNT_ID`

### Google OAuth & Drive
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_DRIVE_CUSTOM_FOLDER_ID`
- `GOOGLE_DRIVE_PRINTING_FOLDER_ID`
- `GOOGLE_DRIVE_PRODUCTS_FOLDER_ID`

### Email
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `BREVO_API_KEY`

### Upstash Redis
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Misc
- `TOKEN_ENCRYPTION_KEY` — For encrypting tokens at rest
- `WEBHOOK_SECRET` — For webhook verification
- `BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_NAME` — Bank transfer info

## Replit Migration Notes

- Dev/start scripts bind to `0.0.0.0:5000` for Replit's proxied preview
- CORS fallback uses `*` when `NEXT_PUBLIC_APP_URL` is not set
- Package manager: npm (package-lock.json)
- `allowedDevOrigins` in `next.config.ts` covers `*.spock.replit.dev` and `*.replit.dev` to suppress cross-origin HMR warnings in the Replit preview pane
- `src/auth.ts` uses `config.supabase.url` / `config.supabase.serviceRoleKey` (from `unifiedConfig`) instead of raw `process.env` directly — this prevents module-load crashes when env vars are missing in dev (unifiedConfig provides placeholder fallbacks)
- All production secrets are stored in Replit Secrets: `AUTH_SECRET`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_SECRET`, `GMAIL_APP_PASSWORD`, `BREVO_API_KEY`, `R2_SECRET_ACCESS_KEY`, and others
- Non-sensitive config set as shared env vars: `NEXT_PUBLIC_SUPABASE_URL`, `AUTH_TRUST_HOST`, `GOOGLE_CLIENT_ID`, `GMAIL_USER`, `R2_ACCESS_KEY_ID`, `R2_BUCKET_NAME`, `CLOUDFLARE_ACCOUNT_ID`, etc.
- If Supabase-related endpoints return DNS errors (`ENOTFOUND`), the Supabase free-tier project may be paused — reactivate it at app.supabase.com
