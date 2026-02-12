/**
 * Studio-Level Naming System — Shared Types
 *
 * Defines enums and interfaces for the production-ready
 * file naming convention used across R2 and Google Drive.
 *
 * Convention: ORD-{CODE}_{STAGE}_{MODEL}_{ASSET}_{VERSION}_{INDEX}.{EXT}
 */

/** Production stage of a file */
export const Stage = {
    /** Customer-uploaded reference images */
    SOURCE: 'SRC',
    /** Demo/preview renders sent to customer */
    DEMO: 'DEMO',
    /** 3D model renders */
    MODEL: 'MODEL',
    /** STL/OBJ 3D print files */
    STL: 'STL',
    /** GCode / slicer output */
    PRINT: 'PRINT',
    /** Finished product photos */
    FINAL: 'FINAL',
    /** Internal QC inspection photos */
    QC: 'QC',
} as const;

export type StageType = typeof Stage[keyof typeof Stage];

/** Subject/model identifier within an order */
export const Model = {
    M1: 'M1',
    M2: 'M2',
    M3: 'M3',
    M4: 'M4',
    M5: 'M5',
    /** Entire composition (all models together) */
    FULL: 'FULL',
} as const;

export type ModelType = typeof Model[keyof typeof Model] | string;

/** Asset/part type */
export const Asset = {
    /** Full figure / whole composition */
    FULL: 'FULL',
    /** Base/stand */
    BASE: 'BASE',
    /** Glass dome/cover */
    GLASS: 'GLASS',
    /** Hat accessory */
    HAT: 'HAT',
    /** Body part */
    BODY: 'BODY',
    /** Primary file */
    FILE: 'FILE',
    /** Master/original file */
    MASTER: 'MASTER',
    /** GCode slicer output */
    GCODE: 'GCODE',
    /** 3D print file */
    THREED: '3D',
} as const;

export type AssetType = typeof Asset[keyof typeof Asset] | string;

/** Numbered Drive subfolder prefixes — sorted for consistent display */
export const DriveFolderPrefix: Record<StageType, string> = {
    SRC: '01_SOURCE',
    DEMO: '02_DEMO',
    MODEL: '03_MODEL',
    STL: '04_STL',
    PRINT: '05_PRINT',
    FINAL: '06_FINAL',
    QC: '07_QC',
};

/** Parameters for generating a studio-compliant filename */
export interface StudioNameParams {
    /** 8-char hex order code, e.g. "C494D49D" */
    orderCode: string;
    /** Production stage */
    stage: StageType;
    /** Model index (default: FULL) */
    model?: ModelType;
    /** Asset/part type (default: FULL) */
    asset?: AssetType;
    /** Version number, 1-based (default: 1 → "V01") */
    version?: number;
    /** File index within this version, 1-based (default: 1 → "01") */
    index?: number;
    /** File extension without leading dot (e.g. "jpg", "stl") */
    extension: string;
}

/**
 * Mapping from legacy upload types to studio stages.
 * Used during the transition period while old APIs still use legacy types.
 */
export const LegacyTypeToStage: Record<string, StageType> = {
    'custom_main': 'SRC',
    'custom_accessory': 'SRC',
    'custom_preview': 'DEMO',
    'printing': 'STL',
    'review': 'DEMO',
    'finished': 'FINAL',
    'qc': 'QC',
};
