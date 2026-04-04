# Two-Phase Printing Quote UX

## What & Why

The printing page currently shows a single result from the XGBoost worker the moment a file is loaded. With the new slicer backend in place, the UX must change to two distinct phases: an immediate fast preview (bbox, file info, volume, "đang tính giá chính xác…") followed by the accurate slicer result (real grams, support grams, print time, layer count, final price) that arrives after slicing completes. The heuristic price formulas on the frontend must be removed so the system never displays guessed values. AI is kept for risk level and print recommendations only.

## Done looks like

- When a user drops a file, the card immediately shows: bounding box dimensions, mesh volume, file size, print type, and a pulsing "Đang phân tích chính xác…" indicator
- After the slicer job completes (typically 5–20 s), the card updates in-place with the real data: main material grams, support material grams, total grams/ml, print time (h:mm), layer count, and final price in VND
- A small badge reads `nguồn: PrusaSlicer` (or `nguồn: cache` when cached) so the user knows it is a real sliced estimate
- The XGBoost worker still runs for **risk detection only** — it shows the `low / medium / high` risk badge and warnings list; it no longer drives the price or grams fields
- The heuristic constants (`DENSITY`, `SHELL_FACTOR`, `INFILL_MAP`, `LAYER_TIME_MULT`) are removed from the frontend entirely
- If the slicer job fails, the card shows a clear Vietnamese error message and falls back to "Vui lòng liên hệ để được báo giá" rather than showing a wrong number
- The order submission payload is updated to send the slicer result fields (`mainMaterialG`, `supportMaterialG`, `printTimeMinutes`, `source`) alongside the existing `price` so the order record is accurate

## Out of scope

- Redesigning the visual layout of the printing page (only data wiring and heuristic removal)
- Admin order detail view updates (the `print_jobs` table schema and admin views are untouched)
- Real-time progress percentage (a simple spinner + elapsed time counter is sufficient)
- Orientation selection UI (future AI feature)

## Tasks

1. **Remove frontend heuristic constants and price calculation** — Delete the `DENSITY`, `SHELL_FACTOR`, `RESIN_FACTOR`, `INFILL_MAP`, `LAYER_TIME_MULT`, and `PRINT_SPEED` constants from `page.tsx` (and from `analyze-stl` types if imported). Remove the `estimateFallback` function that computes grams/hours/price locally. The `AnalysisResult` type gains `mainMaterialG`, `supportMaterialG`, `printTimeMinutes`, `layerCount`, `source` fields; it drops `hours` as a first-class pricing field (hours become a derived display from `printTimeMinutes`).

2. **Polling hook for slicer job** — Create `src/hooks/useSlicerQuote.ts`. It accepts `{ file, params }`, POSTs to `/api/printing/exact-quote`, stores the `jobId`, then polls `/api/printing/quote-status?jobId=...` every 2 s until `status === "completed"` or `status === "failed"`. Exposes `{ status, result, error }`. Uses `useEffect` cleanup to stop polling when the component unmounts or the file changes.

3. **Two-phase card state in the printing page** — Update `src/app/printing/page.tsx` to drive each file item card from the `useSlicerQuote` hook result. Phase 1 state (while `status === "pending"` or `status === "running"`): show bbox, volume, and a loading indicator where grams/price would be. Phase 2 state (`status === "completed"`): fill in the real material/time/price fields and show the `nguồn` badge. Error state: show the error message and a "Yêu cầu báo giá thủ công" fallback button.

4. **Keep XGBoost worker for risk only** — In the worker integration in `page.tsx`, keep the call to the mesh-ai worker but only use its `risk` and `riskScore` output. Disconnect it from price/grams display. The worker result still populates the risk badge and any printability warnings.

5. **Update order submission payload** — In the `handleSubmitOrder` function in `page.tsx`, replace the old `analysis.grams` / `analysis.hours` / `analysis.price` mapping with the new fields (`mainMaterialG`, `supportMaterialG`, `printTimeMinutes`, `layerCount`, `source`, `price`). Ensure the `print_jobs` insert in `/api/orders/printing` accepts these fields (add columns if the table schema needs updating via a Supabase migration).

## Relevant files

- `src/app/printing/page.tsx`
- `src/lib/ai/workers/mesh-ai.worker.ts`
- `src/lib/ai/types/print-ai.ts`
- `src/app/api/orders/printing/route.ts`
