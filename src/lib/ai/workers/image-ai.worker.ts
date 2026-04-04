/**
 * Image AI Web Worker (Task #3)
 * Zero-shot accessory classification using Xenova/mobileclip_s0 via Transformers.js.
 * Runs entirely off the main thread — no server calls, no API keys required.
 *
 * Message protocol:
 *   Request:  ImageAIWorkerRequest  { type: 'analyze', imageUrl, itemId }
 *   Response: ImageAIWorkerResponse | ImageAIWorkerError
 *
 * Pipeline:
 *   1. Lazy-load Xenova/mobileclip_s0 (tokenizer + text model + processor + vision model)
 *      with dtype 'q8' (INT8 quantized) on WASM backend.
 *   2. Pre-compute L2-normalised text embeddings for all 10 labels once; cached in module scope.
 *   3. Per message: fetch image via RawImage.read(imageUrl), compute vision embedding,
 *      apply per-category softmax, map to AccessoryPrediction.
 *
 * Per-category softmax (not global):
 *   Each accessory category (glasses / hat / props) uses its own group of logits
 *   [null_class_score, option_A, option_B, option_C] → softmax.
 *   Detection fires when max(optionA,B,C) > DETECTION_THRESHOLD *and* beats null_class.
 *   This lets glasses AND hat be detected simultaneously (no mutual exclusion).
 *
 * Detection rule:
 *   An option is accepted when its softmax probability within the category group
 *   is both > 0.25 (absolute threshold) AND > null_class probability (must beat null).
 *   Requires being the top-scoring option in the category.
 */

import {
    AutoTokenizer,
    CLIPTextModelWithProjection,
    AutoProcessor,
    CLIPVisionModelWithProjection,
    RawImage,
    PreTrainedTokenizer,
    PreTrainedModel,
    Processor,
    Tensor,
    dot,
    softmax,
    env,
} from '@huggingface/transformers';
import type {
    ImageAIWorkerRequest,
    ImageAIWorkerResponse,
    ImageAIWorkerError,
    AccessoryPrediction,
} from '../types/custom-ai';

// Allow downloads from Hugging Face Hub only; Cache Storage is used by default
env.allowLocalModels = false;

const MODEL_ID            = 'Xenova/mobileclip_s0';
const DETECTION_THRESHOLD = 0.25;

// ─── Label layout ─────────────────────────────────────────────────────────────
// Index 0: null class (no accessories)
// Indices 1-3: glasses options
// Indices 4-6: hat options
// Indices 7-9: props options

const NULL_LABEL = 'a person with no special accessories';

const GLASSES_LABELS = [
    'person wearing round glasses',
    'person wearing square glasses',
    'person wearing sunglasses',
];
const HAT_LABELS = [
    'person wearing baseball cap',
    'person wearing bucket hat',
    'person wearing graduation cap',
];
const PROP_LABELS = [
    'person holding bouquet',
    'person holding book',
    'person holding guitar',
];

const ALL_LABELS = [NULL_LABEL, ...GLASSES_LABELS, ...HAT_LABELS, ...PROP_LABELS];

const GLASSES_VI = ['Kính tròn', 'Kính chữ nhật', 'Kính mát'];
const HAT_VI     = ['Mũ lưỡi trai', 'Mũ bucket', 'Mũ tốt nghiệp'];
const PROP_VI    = ['Cầm bó hoa', 'Cầm sách', 'Cầm đàn guitar'];

// ─── Typed model output shapes ────────────────────────────────────────────────
// These shapes match the actual runtime output of Xenova/mobileclip_s0.
// We assert from the library's own `Promise<any>` / `any` return values using
// these interfaces — the `any` is the library's declared return type, not ours.

interface TextModelOutput  { text_embeds:  Tensor }
interface VisionModelOutput { image_embeds: Tensor }

// ─── Module-scope model & embedding cache ─────────────────────────────────────

type LoadedModels = {
    tokenizer:   PreTrainedTokenizer;
    textModel:   PreTrainedModel;
    processor:   Processor;
    visionModel: PreTrainedModel;
    textEmbeds:  number[][];
};

let modelsPromise: Promise<LoadedModels> | null = null;

async function getModels(): Promise<LoadedModels> {
    if (!modelsPromise) {
        modelsPromise = (async () => {
            const loadOpts = { dtype: 'q8' as const, device: 'wasm' as const };

            // All four components are loaded in parallel and typed via concrete
            // Transformers.js base classes. `from_pretrained` returns
            // Promise<PreTrainedModel> / Promise<PreTrainedTokenizer> / Promise<Processor>.
            const [tokenizer, textModel, processor, visionModel] = await Promise.all([
                AutoTokenizer.from_pretrained(MODEL_ID),
                CLIPTextModelWithProjection.from_pretrained(MODEL_ID, loadOpts),
                AutoProcessor.from_pretrained(MODEL_ID),
                CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, loadOpts),
            ]);

            // PreTrainedTokenizer._call is typed and returns the BatchEncoding shape.
            const textInputs = tokenizer._call(ALL_LABELS, { padding: true, truncation: true });

            // PreTrainedModel._call returns Promise<any> per the library's own types;
            // we narrow to the known output shape via a type assertion on the result.
            const textOutput = await textModel._call(textInputs) as TextModelOutput;
            // Tensor.normalize() → Tensor; Tensor.tolist() → any[]; cast to number[][].
            const textEmbeds = textOutput.text_embeds.normalize().tolist() as number[][];

            return { tokenizer, textModel, processor, visionModel, textEmbeds };
        })().catch((err: unknown) => {
            modelsPromise = null; // allow retry on next message
            throw err;
        });
    }
    return modelsPromise;
}

// ─── Per-category detection helper ────────────────────────────────────────────

/**
 * Given raw logits for [null_class, optionA, optionB, optionC]:
 *  1. Applies softmax within the group (independent of other categories).
 *  2. Finds the best option.
 *  3. Returns detected=true only when:
 *       best option probability > DETECTION_THRESHOLD
 *       AND best option probability > null_class probability.
 */
function detectCategory(
    groupLogits: number[],
    viLabels: string[],
): { detected: boolean; description: string } {
    const probs = softmax(groupLogits) as number[];
    const nullProb  = probs[0];
    const optProbs  = probs.slice(1); // exclude null class at index 0
    const maxPr     = Math.max(...optProbs);

    if (maxPr < DETECTION_THRESHOLD || maxPr <= nullProb) {
        return { detected: false, description: '' };
    }

    const winnerIdx = optProbs.indexOf(maxPr);
    return { detected: true, description: viLabels[winnerIdx] ?? '' };
}

// ─── Worker message handler ────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<ImageAIWorkerRequest>) => {
    const { type, imageUrl, itemId } = event.data;
    if (type !== 'analyze') return;

    try {
        const { processor, visionModel, textEmbeds } = await getModels();

        // RawImage.read(url) fetches the object URL and decodes the image.
        // createImageBitmap (available in Workers) is used under the hood.
        const rawImage = await RawImage.read(imageUrl);

        // Processor._call returns Promise<any> (library type); narrow to pixel values.
        const imageInputs = await processor._call(rawImage) as { pixel_values: Tensor };

        // PreTrainedModel._call returns Promise<any>; narrow to image embeddings.
        const imageOutput = await visionModel._call(imageInputs) as VisionModelOutput;
        // Tensor.tolist() returns any[]; cast inner array to number[].
        const imageEmbed = (imageOutput.image_embeds.normalize().tolist() as number[][])[0];

        // Raw CLIP logit scores (× 100 matching the original paper's scaling)
        const rawLogits: number[] = textEmbeds.map((y) => 100 * dot(imageEmbed, y));

        // Per-category softmax over [null_score, ...option_scores].
        // Each category is independent — both glasses AND hat can be detected.
        const glassesResult = detectCategory(
            [rawLogits[0], rawLogits[1], rawLogits[2], rawLogits[3]],
            GLASSES_VI,
        );
        const hatResult = detectCategory(
            [rawLogits[0], rawLogits[4], rawLogits[5], rawLogits[6]],
            HAT_VI,
        );
        const propsResult = detectCategory(
            [rawLogits[0], rawLogits[7], rawLogits[8], rawLogits[9]],
            PROP_VI,
        );

        const prediction: AccessoryPrediction = {
            hasGlasses:         glassesResult.detected,
            glassesDescription: glassesResult.description,
            hasHat:             hatResult.detected,
            hatDescription:     hatResult.description,
            propsDescription:   propsResult.description,
        };

        const response: ImageAIWorkerResponse = { success: true, itemId, prediction };
        self.postMessage(response);
    } catch {
        const response: ImageAIWorkerError = {
            success: false,
            itemId,
            error: 'AI analysis failed',
        };
        self.postMessage(response);
    }
};

export {};
