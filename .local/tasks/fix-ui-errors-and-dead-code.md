# Fix UI Errors, Worker & Dead Code

## What & Why
After the auth/secrets fix was merged, there are still several runtime errors visible in the browser and server logs. These affect the 3D printing AI worker (fails silently and falls back to server), cause scroll positioning warnings, trigger WebGL context loss without recovery, and there is dead nav component code. Cleaning these up improves reliability and removes noise from logs.

## Done looks like
- No `[MeshAI] Worker bootstrap failed` warning in browser console — the Web Worker loads and runs correctly on the `/printing` page
- No "Please ensure container has non-static position" warning from Lenis SmoothScroll
- WebGL context loss on the HeroJelly / Three.js canvas is handled gracefully (shows a fallback or re-initializes) instead of logging a bare "Context Lost" error
- `NavbarLusion.tsx` component (unused/dead code) is removed from the codebase
- Duplicate `ClientFetchError` auth errors that fired twice on page load are eliminated (session fetch is deduplicated or guarded)

## Out of scope
- Supabase connection setup (handled in the now-merged Task #5)
- New UI features or redesigns
- Server-side API changes beyond what is needed to fix the errors above

## Tasks
1. **Fix MeshAI Worker loading** — Replace the blob-URL trampoline approach in `/printing/page.tsx` with the standard `new Worker(new URL('...', import.meta.url))` pattern (matching how `custom/page.tsx` loads its image-ai worker), so Turbopack emits a proper compiled JS bundle URL instead of a raw `.ts` path that the browser cannot execute.

2. **Fix Lenis SmoothScroll container warning** — Update `SmoothScroll.tsx` so the Lenis instance is initialised with a `wrapper` element that has `position: relative` (or equivalent), or suppress the warning by wrapping the children in a `<div style={{ position: 'relative' }}>` that Lenis targets, eliminating the "non-static position" console warning.

3. **Handle WebGL context loss in HeroJelly** — Add a `webglcontextlost` event listener on the Three.js canvas in `HeroJelly.tsx` (or via React Three Fiber's `onCreated` callback). On context loss, show a static fallback element and attempt re-initialisation or graceful unmount instead of leaving the bare "THREE.WebGLRenderer: Context Lost" log.

4. **Remove NavbarLusion dead code** — Delete `NavbarLusion.tsx` (which is defined but never imported anywhere in the app). Confirm nothing references it before removal.

5. **Deduplicate auth session fetches** — Trace the double `ClientFetchError` on page load to wherever `useSession` or `/api/auth/session` is called redundantly; add a guard or consolidate into a single call so the error (if it occurs) appears only once.

## Relevant files
- `src/app/printing/page.tsx:152-213`
- `src/app/custom/page.tsx:262-325`
- `src/lib/ai/workers/mesh-ai.worker.ts`
- `src/components/ui/SmoothScroll.tsx`
- `src/components/user/HeroJelly.tsx`
- `src/components/layout/NavbarLusion.tsx`
- `src/components/layout/NavLusion.tsx`
- `src/components/layout/LayoutWrapper.tsx`
