# PrusaSlicer Slicer Backend

## What & Why

The current quote system calculates grams, hours, and price using heuristic formulas based purely on mesh volume (e.g. `grams = volume × density × shellFactor`). These numbers are consistently wrong because they ignore infill paths, support geometry, wall count, layer-specific speeds, and hundreds of other slicer variables. The fix is to replace the formula-based backend with real PrusaSlicer CLI slicing: the slicer generates G-code and the system reads the accurate stats directly from that G-code output. AI is kept only for risk detection, orientation hints, and preset recommendations — never for price/grams/time estimation.

## Done looks like

- `POST /api/printing/exact-quote` accepts a 3D file (STL/OBJ/3MF) plus print parameters and returns a `jobId` immediately
- `GET /api/printing/quote-status?jobId=<id>` returns the job's status and, when complete, the full slicer result: `mainMaterialG`, `supportMaterialG`, `totalMaterialG`, `printTimeMinutes`, `layerCount`, `bboxMm`, `price`, `source: "prusaslicer_exact"`
- If the same file + same parameters were sliced before, the cached result is returned from `quote-status` with `source: "cache"`
- All FDM output matches what PrusaSlicer Desktop would show for the same profile and settings (within a few percent)
- Resin output provides `mainResinMl`, `supportResinMl`, `totalResinMl`, `totalResinG`, and `printTimeMinutes` from mSLA slicing
- The existing `/api/analyze-stl` route is updated to return only the fast-preview fields (bbox, volume, triangle count) and explicitly drops the inaccurate `grams`/`hours`/`price` fields from its response — callers should use the new exact-quote flow for pricing

## Out of scope

- Admin UI for managing printer profiles (profiles are code-defined ini files)
- Real-time progress streaming (polling every 2 s is sufficient for v1)
- Persistent job storage across restarts (in-memory map is fine for v1; Supabase persistence is future work)
- Cancelling queued jobs
- Multi-orientation brute-force (AI orientation hints are a separate, future enhancement)
- CuraEngine support (PrusaSlicer only for v1)

## Tasks

1. **Install PrusaSlicer in Nix and verify CLI** — Add `pkgs.prusa-slicer` to `replit.nix` and confirm that `prusa-slicer --version` runs without errors. Note: PrusaSlicer CLI can run headlessly for slicing (no display needed); add `pkgs.xvfb-run` as a safety fallback wrapper only if needed.

2. **Create printer profiles** — Create the directory `printer-profiles/` with two sub-folders (`fdm/` and `resin/`). Write minimal but complete PrusaSlicer `.ini` config files for: `fdm_pla_standard` (0.4 mm nozzle, PLA, 0.2 mm layer, 20% infill, auto-support), `fdm_petg_standard` (same but PETG temperatures), `resin_standard_detail` (mSLA, 0.05 mm layer, standard supports), and `resin_fast` (mSLA, 0.1 mm layer). These are the locked profiles the system accepts; no free-form profile input.

3. **Slicer runner module** — Create `src/lib/slicer/slicerRunner.ts` that takes `{ filePath, printerIni, filamentIni, layerHeight, infill, support, mode }` and executes PrusaSlicer CLI via Node `child_process.spawn`. For FDM it passes `--export-gcode`; for resin it passes `--export-sla`. Both write output to a temp directory. Returns the raw output paths.

4. **G-code / SLA output parser** — Create `src/lib/slicer/outputParser.ts` that reads PrusaSlicer's annotated output comments (lines beginning with `; filament used`, `; support material`, `; estimated printing time`, `; layer_count`) from the G-code file, or reads the mSLA summary JSON/log for resin. Returns the canonical `SlicerResult` TypeScript type.

5. **Slicer cache** — Create `src/lib/slicer/slicerCache.ts` that hashes the file buffer (SHA-256) plus the serialized job config to produce a cache key, stores completed `SlicerResult` objects in a module-level `Map`, and exposes `get(key)` / `set(key, result)`. TTL is 24 h. This is the mechanism that makes re-runs of the same file instant.

6. **Price engine** — Create `src/lib/slicer/priceEngine.ts` with two exported functions: `calculateFdmPrice(result: FdmSlicerResult, params)` and `calculateResinPrice(result: ResinSlicerResult, params)`. Implement the formulas from the spec: material cost + support material cost + machine time cost + post-process cost + packaging + risk margin. Constants (material price per gram, machine hourly rate, etc.) are defined as named constants at the top of the file; do not hard-code magic numbers inline.

7. **Job queue** — Create `src/lib/slicer/jobQueue.ts` with an in-memory `Map<jobId, JobEntry>` where each entry has `{ status: 'pending'|'running'|'completed'|'failed', result?, error?, createdAt }`. Expose `enqueue(jobId, fn)` which runs `fn` asynchronously and updates the map entry on completion or failure. Prune jobs older than 1 h to avoid memory leaks.

8. **Exact-quote API routes** — Create `src/app/api/printing/exact-quote/route.ts` (POST) and `src/app/api/printing/quote-status/route.ts` (GET). The POST route: authenticates the request, validates the file extension and size (max 50 MB), computes the cache key, checks the cache, and either returns the cached result immediately (`status: "completed"`) or writes the file to a temp path, enqueues the slicer job, and returns `{ jobId, status: "pending" }`. The GET route: looks up the jobId in the job queue map and returns the current status/result.

9. **Update `/api/analyze-stl`** — Strip out the `grams`, `hours`, and `price` fields from the response of the existing route; keep only `volume`, `boundingBox`, `triangleCount`, and `warning`. Add a `_deprecated_pricing` note in a comment so the frontend migration in the next task knows what changed.

## Relevant files

- `replit.nix`
- `src/app/api/analyze-stl/route.ts`
- `src/lib/ai/workers/mesh-ai.worker.ts`
- `src/lib/ai/features/meshFeatures.ts`
- `src/app/api/orders/printing/route.ts`
