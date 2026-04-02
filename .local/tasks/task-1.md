---
title: 3D printing client-side AI
---
# 3D Printing Client-Side AI

## What & Why
Add AI-powered price estimation, print time, and risk classification to the `/printing` page. All inference runs in the browser using a Web Worker — no server calls, no external AI APIs. Three XGBoost models (JSON format) run inside the worker: one for price, one for print time, and one for risk level. This replaces the simple formula-based calculation with a smarter, more accurate model, and adds a visible "AI running on your device" badge that makes for a strong demo moment.

## Done looks like
- When a user uploads a `.stl` or `.obj` file on `/printing`, the page shows an AI-generated price estimate, print time, and a risk label (low/medium/high) alongside a confidence indicator
- A small badge reads "AI chạy trực tiếp trên trình duyệt" (AI running directly in your browser)
- Analysis runs entirely client-side — no network request to `/api/analyze-stl` for the AI portion (the existing STL volume parsing server route can remain as a fallback)
- The Web Worker runs on a separate thread so the UI stays responsive during inference
- The three XGBoost JSON models are served from `/public/models/` and cached by the browser after first load
- The feature degrades gracefully: if the worker fails or the model can't load, the page falls back to the existing formula-based calculation silently

## Out of scope
- Training the models on real production data (models are trained on realistic synthetic data as a starting point)
- GPU/WebGPU acceleration (WASM is the default runtime; WebGPU is future work)
- The custom figurine image AI (that is a separate task)

## Tasks
1. **AI runtime infrastructure** — Create `src/lib/ai/runtime/` with a device-tier detector and a minimal ONNX Runtime Web wrapper (WASM mode). Also create shared TypeScript types under `src/lib/ai/types/print-ai.ts`. Install `onnxruntime-web` as a dependency.

2. **Mesh feature extractor** — Create `src/lib/ai/features/meshFeatures.ts` that parses the raw STL/OBJ geometry client-side (volume, bounding box x/y/z, surface area, triangle count, fill ratio, slenderness, thin-part proxy, support proxy) and returns the 12-feature vector expected by the XGBoost models.

3. **XGBoost JSON runner** — Create `src/lib/ai/models/xgbRunner.ts`, a lightweight TypeScript tree-ensemble inference engine that loads a model exported as XGBoost JSON and runs predict on a feature vector. This must work in a Web Worker context with no DOM APIs.

4. **Train and export models** — Write a Python script `scripts/train_print_models.py` that generates realistic synthetic training data (500–1000 samples), trains three XGBoost models (`quote_regressor`, `time_regressor`, `risk_classifier`), and exports them to `public/models/quote_xgb.json`, `public/models/time_xgb.json`, `public/models/risk_xgb.json`. Run the script and commit the exported models.

5. **Web Worker** — Create `src/lib/ai/workers/mesh-ai.worker.ts` that receives a `{ fileBuffer, fileName, type, infill, layerHeight }` message, extracts mesh features, runs all three XGBoost models, and posts back `{ price, hours, risk, confidence, source: 'ai' }`.

6. **Wire into the printing page** — Update `src/app/printing/page.tsx` to spawn the mesh-ai worker when a file is uploaded, display the AI results (price, hours, risk badge, confidence), show the "AI chạy trực tiếp trên trình duyệt" badge, and fall back to the existing formula path if the worker errors.

## Relevant files
- `src/app/printing/page.tsx`
- `src/app/api/analyze-stl/route.ts`