---
title: MobileCLIP zero-shot image AI for /custom
---
# Replace Image AI with MobileCLIP Zero-Shot

## What & Why

Swap the current `accessory_classifier.onnx` (hand-crafted MobileNetV2 + sparse
linear head, shipped in Task #2) for `Xenova/mobileclip_s0` running via
`@huggingface/transformers` (Transformers.js).

MobileCLIP-S0 is a true zero-shot image–language model: it scores image similarity
against free-form text labels, so no per-task training or hand-crafted weight
matrices are needed. This gives far more reliable accessory detection because the
model was pre-trained on 400M image–caption pairs and explicitly understands
natural-language descriptions like "person wearing sunglasses" or "person holding
a bouquet". The previous approach scored only 1000 fixed ImageNet logits against
two sparse learned rows, which was a best-effort approximation.

Additional scope: add `propsDescription` auto-fill (bouquet, book, guitar) all the
way through to order creation — `CharacterData`, the AI worker, the accessory panel
UI, the submit payload, and the confirm step.

## Done looks like

- Uploading a character photo on `/custom` still triggers the existing "AI đang
  phân tích ảnh…" spinner and "AI phân tích trên thiết bị của bạn" badge — the
  wizard steps, form layout, and accessory toggle UX are unchanged. The AI layer
  is additive: it auto-fills fields the user has not yet touched.
- `hasGlasses`, `glassesDescription`, `hasHat`, `hatDescription`, and the new
  `propsDescription` field are auto-filled based on zero-shot CLIP scores.
- `propsDescription` is persisted: it appears in the accessory panel as a read-only
  chip, is included in the `handleSubmit` payload sent to `/api/orders/custom`, and
  is visible in the `StepConfirm` review alongside the glasses/hat chips.
- Stale-response safety (token + dirty flags) and user-override behaviour carry
  over from Task #2, extended to cover `editedProps`.
- TypeScript compiles clean; `accessory_classifier.onnx`, `mobilenet_backbone.onnx`,
  and `accessory_head.onnx` are removed from `public/models/` (no longer needed).

## Out of scope

- The `/printing` XGBoost pipeline (Task #1) — untouched.
- OWL-ViT "advanced mode" — mentioned in the background brief as optional; excluded.
- Server-side inference, external API calls, or user-facing error messages.
- Props having a photo-upload mode (text-only for props is intentional; it avoids
  changing the `FileInfo.category` union or the backend file-upload flow).
- Any Stripe / Supabase / auth changes.

## Tasks

1. **Install Transformers.js** — Install `@huggingface/transformers`. Verify it
   resolves correctly in the Next.js webpack worker bundle (the package is
   browser-first and ESM-compatible; no extra webpack aliases expected).

2. **Rewrite image AI worker** — Replace the current ORT session code with a
   Transformers.js pipeline:
   - Load `Xenova/mobileclip_s0` (tokenizer + text model + processor + vision model)
     with `dtype: 'q8'` and `device: 'wasm'`; lazy-init on first message. The
     existing file `src/lib/ai/workers/image-ai.worker.ts` is replaced in-place.
   - Pre-compute text embeddings for the fixed label set once, cache in module
     scope; re-use across uploads.
   - Per message: receive `imageUrl: string` (object URL from main thread), load via
     `RawImage.read()`, compute vision embedding, cosine-similarity + softmax, map
     to `AccessoryPrediction`.
   - Labels (map to Vietnamese descriptions when predicting positive):
     - Glasses: "person wearing round glasses" → Kính tròn,
       "person wearing square glasses" → Kính chữ nhật,
       "person wearing sunglasses" → Kính mát
     - Hat: "person wearing baseball cap" → Mũ lưỡi trai,
       "person wearing bucket hat" → Mũ bucket,
       "person wearing graduation cap" → Mũ tốt nghiệp
     - Props: "person holding bouquet" → Cầm bó hoa,
       "person holding book" → Cầm sách,
       "person holding guitar" → Cầm đàn guitar
     - Null-class: "a person with no special accessories" (suppresses false positives)
   - Detection threshold: 0.25 (CLIP zero-shot probabilities are naturally flatter
     across many labels than a binary sigmoid; 0.50 would suppress all detections).
   - Replace/delete `src/lib/ai/features/imagePreprocess.ts` and
     `src/lib/ai/runtime/ort.ts` — both are replaced by Transformers.js internals.

3. **Update types, page, and order payload** —
   Update `src/lib/ai/types/custom-ai.ts`:
   - `ImageAIWorkerRequest`: replace `preprocessedData + width + height` with
     `imageUrl: string`.
   - `AccessoryPrediction`: add `propsDescription: string`.
   Update `src/app/custom/page.tsx`:
   - Remove `preprocessImage` import; in `handleCharacterImageUpload`, send
     `character.imagePreview` (the already-created object URL) directly to the worker
     instead of running the preprocessing step.
   - Add `propsDescription: ''` to `CharacterData` interface and
     `createEmptyCharacter()`.
   - Extend `AiCharState` with `editedProps: boolean`; track it in `updateCharacter`
     (same dirty-flag pattern as glasses/hat).
   - Handle `propsDescription` in the AI response handler (copy only when
     `!state.editedProps`; always clear on negative result).
   - On new upload, clear `propsDescription` alongside glasses/hat fields.
   - Add a read-only props chip in the accessory panel (below the hat section):
     visible only when `propsDescription` is non-empty; shows the Vietnamese text
     with a small gift/prop icon and an ×-clear button.
   - **Persist in submit payload**: in `handleSubmit`, add `propsDescription:
     c.propsDescription` to `characters.map(...)` alongside `glassesDescription` and
     `hatDescription` (currently at approx. lines 520-525).
   - **Show in confirm step**: in `StepConfirm`, add a `propsDescription` chip next
     to the existing glasses/hat chips (currently at approx. lines 1428-1432).

4. **Update CSP and cleanup** — In `next.config.ts`, add Hugging Face CDN domains
   to `connect-src`:
   - `https://huggingface.co`
   - `https://cdn-lfs-us-1.huggingface.co`
   - `https://cdn-lfs.huggingface.co`
   Also verify at runtime (via browser DevTools) that no additional HF sub-domains
   are contacted; add them if needed. Remove `public/models/accessory_classifier.onnx`,
   `mobilenet_backbone.onnx`, and `accessory_head.onnx`. Update `replit.md` to
   reflect the new architecture.

## Relevant files

All files below exist in the current `main` branch (Task #2 merged them):

- `src/lib/ai/workers/image-ai.worker.ts`
- `src/lib/ai/types/custom-ai.ts`
- `src/lib/ai/features/imagePreprocess.ts`
- `src/lib/ai/runtime/ort.ts`
- `src/app/custom/page.tsx:25-36,115-130,185-215,260-385,495-545,680-690,1095-1145,1340-1440`
- `next.config.ts:45-60`
- `public/models/accessory_classifier.onnx`
- `public/models/mobilenet_backbone.onnx`
- `public/models/accessory_head.onnx`
- `replit.md:29-43`