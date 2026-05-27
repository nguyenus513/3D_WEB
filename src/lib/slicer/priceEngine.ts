import type { FdmSlicerResult, ResinSlicerResult } from './types';
import { calculatePrintingPrice } from '@/lib/printing/pricing-engine';

export interface PriceBreakdown {
    materialCost: number;
    machineCost: number;
    total: number;
    formulaVersion: string;
}

export function calculateFdmPrice(
    result: FdmSlicerResult,
    quantity = 1,
    layerHeight = 0.2,
    infill: string | number = 20,
): PriceBreakdown {
    const breakdown = calculatePrintingPrice({
        technology: 'fdm',
        grams: result.totalMaterialG,
        timeHours: result.printTimeMinutes / 60,
        infill,
        layerHeight,
        quantity,
    });

    return {
        materialCost: breakdown.materialCost,
        machineCost: breakdown.machineCost,
        total: breakdown.total,
        formulaVersion: breakdown.formulaVersion,
    };
}

export function calculateResinPrice(
    result: ResinSlicerResult,
    quantity = 1,
): PriceBreakdown {
    const breakdown = calculatePrintingPrice({
        technology: 'resin',
        grams: result.totalResinG,
        timeHours: result.printTimeMinutes / 60,
        quantity,
    });

    return {
        materialCost: breakdown.materialCost,
        machineCost: breakdown.machineCost,
        total: breakdown.total,
        formulaVersion: breakdown.formulaVersion,
    };
}
