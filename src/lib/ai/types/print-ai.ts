export interface MeshFeatures {
    volume_cm3: number;
    bbox_x: number;
    bbox_y: number;
    bbox_z: number;
    surface_area: number;
    triangle_count: number;
    fill_ratio: number;
    slenderness: number;
    support_proxy: number;
    thin_part_proxy: number;
    material_fdm: number;
    infill_pct: number;
    layer_height: number;
}

export const FEATURE_NAMES: (keyof MeshFeatures)[] = [
    'volume_cm3',
    'bbox_x',
    'bbox_y',
    'bbox_z',
    'surface_area',
    'triangle_count',
    'fill_ratio',
    'slenderness',
    'support_proxy',
    'thin_part_proxy',
    'material_fdm',
    'infill_pct',
    'layer_height',
];

export type RiskLevel = 'low' | 'medium' | 'high';

export interface PrintAIResult {
    risk: RiskLevel;
    riskScore: number;
    confidence: number;
    source: 'ai';
}

export interface MeshWorkerRequest {
    type: 'analyze';
    fileBuffer: ArrayBuffer;
    fileName: string;
    printType: 'fdm' | 'resin';
    infill: string;
    layerHeight: string;
    itemId: string;
}

export interface MeshWorkerResponse {
    success: true;
    itemId: string;
    result: PrintAIResult & {
        volume: number;
        boundingBox: { x: number; y: number; z: number };
        triangleCount: number;
    };
}

export interface MeshWorkerError {
    success: false;
    itemId: string;
    error: string;
}
