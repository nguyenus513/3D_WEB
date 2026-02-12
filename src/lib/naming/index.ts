/**
 * Studio Naming — Barrel Export
 *
 * Re-exports all naming functions and types from a single entry point:
 *   import { generateStudioName, Stage } from '@/lib/naming';
 */

export {
    generateStudioName,
    generateStudioR2Key,
    generateStudioDrivePath,
    getExtension,
    getNextVersion,
    getNextIndex,
} from './studio-naming';

export {
    Stage,
    Model,
    Asset,
    DriveFolderPrefix,
    LegacyTypeToStage,
    type StageType,
    type ModelType,
    type AssetType,
    type StudioNameParams,
} from './types';
