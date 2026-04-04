import type { FdmSlicerResult, ResinSlicerResult } from './types';

const FDM_MATERIAL_PER_G    = 700;
const FDM_MACHINE_BASE_PER_H = 4_000;
const FDM_MACHINE_MULTIPLIER = 0.2;
const FDM_REFERENCE_LAYER   = 0.2;

const RESIN_MATERIAL_PER_G  = 4_000;
const RESIN_MACHINE_PER_H   = 4_000;
const RESIN_MACHINE_MULTIPLIER = 0.2;

const MIN_FDM_PRICE   = 15_000;
const MIN_RESIN_PRICE = 20_000;

export interface PriceBreakdown {
    materialCost: number;
    machineCost: number;
    total: number;
}

function roundTo500(n: number): number {
    return Math.max(500, Math.round(n / 500) * 500);
}

/**
 * FDM price = gram × 700 + giờ × 5000 × (0.2 / layerHeight) × 1.5
 */
export function calculateFdmPrice(
    result: FdmSlicerResult,
    quantity = 1,
    layerHeight = 0.2,
): PriceBreakdown {
    const printHours  = result.printTimeMinutes / 60;
    const materialCost = result.totalMaterialG * FDM_MATERIAL_PER_G;
    const machineCost  = printHours * FDM_MACHINE_BASE_PER_H * (FDM_REFERENCE_LAYER / layerHeight) * FDM_MACHINE_MULTIPLIER;
    const subtotal     = materialCost + machineCost;
    const total        = Math.max(MIN_FDM_PRICE, roundTo500(subtotal * quantity));

    return {
        materialCost: Math.round(materialCost),
        machineCost:  Math.round(machineCost),
        total,
    };
}

/**
 * Resin price = gram × 4000 + giờ × 5000
 */
export function calculateResinPrice(
    result: ResinSlicerResult,
    quantity = 1,
): PriceBreakdown {
    const printHours   = result.printTimeMinutes / 60;
    const materialCost = result.totalResinG * RESIN_MATERIAL_PER_G;
    const machineCost  = printHours * RESIN_MACHINE_PER_H * RESIN_MACHINE_MULTIPLIER;
    const subtotal     = materialCost + machineCost;
    const total        = Math.max(MIN_RESIN_PRICE, roundTo500(subtotal * quantity));

    return {
        materialCost: Math.round(materialCost),
        machineCost:  Math.round(machineCost),
        total,
    };
}
