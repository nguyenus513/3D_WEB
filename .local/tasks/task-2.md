---
title: Custom image AI auto-fill
---
# Custom Image AI Auto-fill

## What & Why
Add a client-side AI feature to the `/custom` page that analyzes a character photo when uploaded and automatically fills in the glasses and hat fields. A MobileNetV3-Small multi-label classifier runs via ONNX Runtime Web inside a Web Worker. When the user uploads a character image, the model detects accessories (glasses type, hat type, props) and pre-fills `hasGlasses`, `glassesDescription`, `hasHat`, and `hatDescription` in the order form. The user can override the suggestions at any time. A small badge shows "AI phân tích trên thiết bị của bạn" (AI analyzing on your device).

## Done looks like
- When a user uploads a character photo in any character step on `/custom`, a brief "AI đang phân tích..." indicator appears
- After ~1–3 seconds, the glasses toggle and description field are pre-filled if glasses are detected; the hat toggle and description are pre-filled if a hat is detected
- The user can still edit or clear these values freely
- A small badge reads "AI phân tích trên thiết bị của bạn"
- Inference runs entirely in a Web Worker with no server call
- The model and worker are only loaded when the user visits `/custom` (lazy load)
- If the model fails to load or inference errors, the form simply stays empty with no user-visible error

## Out of scope
- Training on real labeled character images (the task ships a quantized pre-trained MobileNetV3-Small model downloaded from a public ONNX model zoo as a starting point; full custom training is future work)
- YOLO/bounding-box detection (multi-label classification is sufficient and much lighter)
- Detecting props beyond glasses and hat for the initial version

## Tasks
1. **ImageAI types and preprocess utility** — Create `src/lib/ai/types/custom-ai.ts` with the output type (`hasGlasses`, `glassesType`, `hasHat`, `hatType`, confidence scores) and `src/lib/ai/features/imagePreprocess.ts` that resizes an image File/Blob to 224×224 and returns a normalized Float32Array suitable for MobileNetV3 input.

2. **Obtain and place the ONNX model** — Download a quantized MobileNetV3-Small ONNX model (INT8, ~3–4 MB) from a public model source (ONNX Model Zoo or HuggingFace) and save it to `public/models/accessory_classifier.onnx`. If no suitable pre-trained multi-label model is available, use a standard ImageNet MobileNetV3-Small as the backbone and add a sigmoid classification head stub that returns dummy probabilities, so the full pipeline can be demonstrated end-to-end. The model must be under 10 MB.

3. **Web Worker** — Create `src/lib/ai/workers/image-ai.worker.ts` that receives a `{ imageData: Float32Array, width: number, height: number }` message, runs ONNX inference using the shared ORT runtime from Phase 1, maps the sigmoid outputs to the labeled accessory fields, and posts back the structured result.

4. **Wire into the custom page** — Update `src/app/custom/page.tsx` so that after a character image is uploaded (`handleCharacterImageUpload`), the image-ai worker is spawned (or reused if already loaded). Display a brief analyzing indicator on the character step card, then apply the returned predictions to that character's `hasGlasses`/`glassesDescription`/`hasHat`/`hatDescription` state. Show the "AI phân tích trên thiết bị của bạn" badge.

## Relevant files
- `src/app/custom/page.tsx`
- `src/lib/ai/runtime/` (created in the printing AI task)