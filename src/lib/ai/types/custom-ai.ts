/**
 * Type definitions for the custom figurine image AI (Task #3).
 * The image AI detects accessories (glasses, hat, props) from a character photo
 * and auto-fills the corresponding fields in the order form.
 *
 * Pipeline:
 *   Main thread: uploads image → creates object URL → sends URL to worker
 *   Worker:      Xenova/mobileclip_s0 zero-shot classification
 *                → per-category softmax → AccessoryPrediction
 */

export interface AccessoryPrediction {
    hasGlasses: boolean;
    glassesDescription: string;

    hasHat: boolean;
    hatDescription: string;

    propsDescription: string;
}

export interface ImageAIWorkerRequest {
    type: 'analyze';
    /** Object URL (blob://…) of the character image created on the main thread */
    imageUrl: string;
    itemId: string;
}

export interface ImageAIWorkerResponse {
    success: true;
    itemId: string;
    prediction: AccessoryPrediction;
}

export interface ImageAIWorkerError {
    success: false;
    itemId: string;
    error: string;
}
