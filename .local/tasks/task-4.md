---
title: Fix Turbopack dev errors
---
# Fix Turbopack Dev Errors

## What & Why
Three distinct errors show up every time the dev server runs under Turbopack:
1. A cross-origin warning about `allowedDevOrigins` that Next.js 16 will eventually enforce as a hard block (caused by Replit's preview iframe origin being different from `localhost`)
2. `[MeshAI Worker error]` — the mesh AI web worker crashes on load with "uncaught exception, not an error object", meaning the Turbopack-bundled ES module worker fails to initialize before any message is even received
3. Dead `onnxruntime-web` dependency left in `package.json` after `ort.ts` was removed in Task #3, which can cause Turbopack to attempt bundling unnecessary WASM assets

## Done looks like
- No `allowedDevOrigins` cross-origin warning in the dev server console
- No `[MeshAI Worker error]` in the browser console when visiting `/printing`; the worker loads and either succeeds or fails with a structured `MeshWorkerError` message (not a raw onerror event)
- `onnxruntime-web` is absent from `package.json` and `node_modules`
- `npm run build` (or the dev server) produces no new TypeScript errors or warnings from this change

## Out of scope
- Fixing the `THREE.WebGLRenderer: Context Lost` error (GPU unavailable in the Replit container — not fixable in code)
- Fixing `ClientFetchError` / Supabase auth errors (missing `.env.local` in dev — pre-existing, not Turbopack)
- Adding Supabase credentials or any environment-variable changes

## Tasks

1. **Add `allowedDevOrigins`** — Add an `allowedDevOrigins` array to the `nextConfig` object in `next.config.ts`. Use `process.env.REPLIT_DEV_DOMAIN` at runtime if set, otherwise fall back to `['*.replit.dev', '*.spock.replit.dev']` so both Replit preview patterns are covered. This eliminates the cross-origin warning.

2. **Diagnose and fix the MeshAI worker initialization failure** — The worker is created with `{ type: 'module' }` and the Turbopack bundle for it throws a non-Error value before `self.onmessage` is ever registered. Investigate whether: (a) any transitive import has a module-level side-effect that throws in a browser worker context under Turbopack, (b) a known Turbopack limitation with module-type workers requires a workaround (e.g. adding a `turbopack` config block, switching the worker entry to a blob URL in development only, or adjusting the import chain). Fix so the worker loads cleanly and falls back to the structured `MeshWorkerError` path for actual inference errors.

3. **Remove `onnxruntime-web` dependency** — Uninstall `onnxruntime-web` from `package.json`. Verify no remaining source file imports from it (search `src/` for `onnxruntime-web` and `ort.ts`). Update `replit.md` to remove the ONNX runtime from the dependency list.

## Relevant files
- `next.config.ts`
- `src/lib/ai/workers/mesh-ai.worker.ts`
- `src/lib/ai/models/xgbRunner.ts`
- `src/lib/ai/features/meshFeatures.ts`
- `src/lib/ai/types/print-ai.ts`
- `package.json`
- `replit.md`