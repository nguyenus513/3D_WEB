/**
 * Studio-Level Naming Engine
 *
 * Central module for generating production-ready file names,
 * R2 storage keys, and Google Drive folder paths.
 *
 * Convention:
 *   ORD-{CODE}_{STAGE}_{MODEL}_{ASSET}_{VERSION}_{INDEX}.{EXT}
 *
 * Examples:
 *   ORD-C494D49D_SRC_M1_FULL_V01_01.jpg
 *   ORD-C494D49D_DEMO_FULL_V02_01.jpg
 *   ORD-C494D49D_STL_M1_FILE_V01_3D.stl
 *   ORD-C494D49D_FINAL_FULL_V01_01.jpg
 */

import {
    type StudioNameParams,
    type StageType,
    DriveFolderPrefix,
} from './types';

// ─── Helpers ────────────────────────────────────────────────────────

/** Pad a number to 2 digits: 1 → "01", 12 → "12" */
function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

/** Sanitise order code: uppercase, strip non-hex chars */
function sanitizeOrderCode(code: string): string {
    return code.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
}

/** Normalise file extension: strip leading dot, lowercase */
function normalizeExt(ext: string): string {
    return ext.replace(/^\./, '').toLowerCase();
}

// ─── Core Functions ─────────────────────────────────────────────────

/**
 * Generate a studio-compliant filename.
 *
 * @example
 * generateStudioName({
 *   orderCode: 'C494D49D',
 *   stage: 'DEMO',
 *   model: 'FULL',
 *   asset: 'FULL',
 *   version: 2,
 *   index: 1,
 *   extension: 'jpg',
 * })
 * // → "ORD-C494D49D_DEMO_FULL_V02_01.jpg"
 */
export function generateStudioName(params: StudioNameParams): string {
    const {
        orderCode,
        stage,
        model = 'FULL',
        asset = 'FULL',
        version = 1,
        index = 1,
        extension,
    } = params;

    const code = sanitizeOrderCode(orderCode);
    const ext = normalizeExt(extension);
    const versionStr = `V${pad2(version)}`;
    const indexStr = pad2(index);
    const modelStr = model.toUpperCase();
    const assetStr = asset.toUpperCase();

    return `ORD-${code}_${stage}_${modelStr}_${assetStr}_${versionStr}_${indexStr}.${ext}`;
}

/**
 * Generate an R2 storage key using studio naming.
 *
 * Structure: orders/{ORDER_CODE}/{stage_folder}/{studio_name}
 *
 * @example
 * generateStudioR2Key({
 *   orderCode: 'C494D49D',
 *   stage: 'DEMO',
 *   version: 1,
 *   index: 1,
 *   extension: 'jpg',
 * })
 * // → "orders/C494D49D/demo/ORD-C494D49D_DEMO_FULL_V01_01.jpg"
 */
export function generateStudioR2Key(params: StudioNameParams): string {
    const code = sanitizeOrderCode(params.orderCode);
    const stageFolder = params.stage.toLowerCase();
    const fileName = generateStudioName(params);

    return `orders/${code}/${stageFolder}/${fileName}`;
}

/**
 * Generate Google Drive folder path segments for an order stage.
 *
 * Structure: ORD-{CODE} / {XX_STAGE} / [V{VV}] / [M{N}]
 *
 * @example
 * generateStudioDrivePath({
 *   orderCode: 'C494D49D',
 *   stage: 'DEMO',
 *   version: 2,
 * })
 * // → ["ORD-C494D49D", "02_DEMO", "V02"]
 *
 * generateStudioDrivePath({
 *   orderCode: 'C494D49D',
 *   stage: 'MODEL',
 *   model: 'M1',
 * })
 * // → ["ORD-C494D49D", "03_MODEL", "M1"]
 */
export function generateStudioDrivePath(params: {
    orderCode: string;
    stage: StageType;
    version?: number;
    model?: string;
}): string[] {
    const code = sanitizeOrderCode(params.orderCode);
    const stageFolder = DriveFolderPrefix[params.stage] || params.stage;
    const segments = [`ORD-${code}`, stageFolder];

    // Add version subfolder for stages that version (DEMO, MODEL)
    if (params.version && ['DEMO', 'MODEL'].includes(params.stage)) {
        segments.push(`V${pad2(params.version)}`);
    }

    // Add model subfolder for MODEL stage
    if (params.model && params.stage === 'MODEL') {
        segments.push(params.model.toUpperCase());
    }

    return segments;
}

/**
 * Extract file extension from a filename.
 * Returns lowercase extension without the dot.
 */
export function getExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length > 1) {
        return parts.pop()!.toLowerCase();
    }
    return 'bin';
}

/**
 * Determine the next version number for a given stage.
 * Reads existing files and finds the max version.
 */
export function getNextVersion(
    existingFiles: Array<{ stage?: string; version?: number }>,
    stage: StageType
): number {
    const maxVersion = existingFiles
        .filter(f => f.stage === stage)
        .reduce((max, f) => Math.max(max, f.version || 1), 0);
    return maxVersion + 1;
}

/**
 * Determine the next index within a version.
 */
export function getNextIndex(
    existingFiles: Array<{ stage?: string; version?: number }>,
    stage: StageType,
    version: number
): number {
    const count = existingFiles
        .filter(f => f.stage === stage && f.version === version)
        .length;
    return count + 1;
}
