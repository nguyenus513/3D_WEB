export type PrintMode = 'fdm' | 'resin';
export type SlicerSource = 'prusaslicer_exact' | 'sla_geometry_calc' | 'cache';

export interface BoundingBox {
    x: number;
    y: number;
    z: number;
}

export interface FdmSlicerResult {
    mode: 'fdm';
    bboxMm: BoundingBox;
    volumeCm3: number;
    mainMaterialG: number;
    supportMaterialG: number;
    totalMaterialG: number;
    printTimeMinutes: number;
    layerCount: number;
    source: SlicerSource;
    profileId: string;
}

export interface ResinSlicerResult {
    mode: 'resin';
    bboxMm: BoundingBox;
    volumeCm3: number;
    mainResinMl: number;
    supportResinMl: number;
    totalResinMl: number;
    totalResinG: number;
    printTimeMinutes: number;
    layerCount: number;
    source: SlicerSource;
    profileId: string;
}

export type SlicerResult = FdmSlicerResult | ResinSlicerResult;

export interface SliceJobParams {
    mode: PrintMode;
    profileId: string;
    layerHeight: number;
    infill: number;
    support: boolean;
    quantity: number;
}

export interface JobEntry {
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: SlicerResult & { price: number };
    error?: string;
    createdAt: number;
}

export type QuoteResult = (FdmSlicerResult | ResinSlicerResult) & { price: number };
