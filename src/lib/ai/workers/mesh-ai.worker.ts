/**
 * Mesh AI Web Worker — Risk Detection Only
 * Runs client-side STL/OBJ parsing + XGBoost risk classification.
 * Price and grams estimation have been removed; use /api/printing/exact-quote
 * (PrusaSlicer backend) for accurate quotes.
 *
 * Message protocol:
 *   Request:  MeshWorkerRequest  (from page)
 *   Response: MeshWorkerResponse | MeshWorkerError  (to page)
 */

import { extractMeshFeatures } from '../features/meshFeatures';
import { XGBMulticlassRunner } from '../models/xgbRunner';
import type { MeshFeatures, RiskLevel, MeshWorkerRequest, MeshWorkerResponse, MeshWorkerError } from '../types/print-ai';
import { FEATURE_NAMES } from '../types/print-ai';

const MODEL_BASE = `${self.location.origin}/models/`;

let riskRunner: XGBMulticlassRunner | null = null;
let modelsLoading: Promise<void> | null = null;

async function loadModels(): Promise<void> {
    if (modelsLoading) return modelsLoading;

    modelsLoading = (async () => {
        riskRunner = new XGBMulticlassRunner([
            `${MODEL_BASE}risk_xgb_0.json`,
            `${MODEL_BASE}risk_xgb_1.json`,
            `${MODEL_BASE}risk_xgb_2.json`,
        ]);
        await riskRunner.load();
    })();

    return modelsLoading;
}

function featuresToRecord(features: MeshFeatures): Record<string, number> {
    const rec: Record<string, number> = {};
    for (const key of FEATURE_NAMES) {
        rec[key] = features[key] as number;
    }
    return rec;
}

const RISK_LABELS: RiskLevel[] = ['low', 'medium', 'high'];

self.onmessage = async (event: MessageEvent<MeshWorkerRequest>) => {
    const { type, fileBuffer, fileName, printType, infill, layerHeight, itemId } = event.data;

    if (type !== 'analyze') return;

    try {
        const extractResult = extractMeshFeatures(fileBuffer, fileName, {
            printType,
            infill,
            layerHeight,
        });

        const { features, volume_cm3, boundingBox, triangleCount } = extractResult;
        const featureRecord = featuresToRecord(features);

        await loadModels();

        if (!riskRunner) {
            throw new Error('Risk model failed to load');
        }

        const { classIndex, probabilities } = riskRunner.predictClassIndex(featureRecord);

        const risk: RiskLevel = RISK_LABELS[classIndex] ?? 'medium';
        const riskScore = probabilities[classIndex] ?? 0.5;
        const confidence = Math.min(
            0.95,
            0.7 + (triangleCount > 1000 ? 0.15 : 0) + (volume_cm3 > 1 ? 0.1 : 0),
        );

        const response: MeshWorkerResponse = {
            success: true,
            itemId,
            result: {
                risk,
                riskScore: Math.round(riskScore * 100) / 100,
                confidence: Math.round(confidence * 100) / 100,
                source: 'ai',
                volume: Math.round(volume_cm3 * 100) / 100,
                boundingBox,
                triangleCount,
            },
        };

        self.postMessage(response);
    } catch (err) {
        const response: MeshWorkerError = {
            success: false,
            itemId,
            error: err instanceof Error ? err.message : String(err),
        };
        self.postMessage(response);
    }
};

export {};
