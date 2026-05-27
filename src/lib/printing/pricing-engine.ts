export type PrintTechnology = 'fdm' | 'resin';

export const PRINTING_PRICE_FORMULA_VERSION = 'miniver_volume_v2_user_formula_2026_05_27';

export interface PrintingPriceInput {
    technology: PrintTechnology;
    grams: number;
    timeHours: number;
    infill?: string | number;
    layerHeight?: string | number;
    quantity?: number;
}

export interface PrintingPriceBreakdown {
    technology: PrintTechnology;
    grams: number;
    timeHours: number;
    infillRatio: number;
    layerHeightMm: number;
    quantity: number;
    baseMaterialCost: number;
    baseMachineCost: number;
    infillMultiplier: number;
    materialCost: number;
    machineCost: number;
    subtotal: number;
    total: number;
    formulaVersion: string;
}

function finitePositive(value: number, fallback: number) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function normalizeInfill(value: string | number | undefined): number {
    if (typeof value === 'string') {
        const parsed = Number(value.replace('%', '').trim());
        if (Number.isFinite(parsed) && parsed > 0) return parsed > 1 ? parsed / 100 : parsed;
    }
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value > 1 ? value / 100 : value;
    }
    return 0.2;
}

export function normalizeLayerHeight(value: string | number | undefined): number {
    if (typeof value === 'string') return finitePositive(Number(value.replace('mm', '').trim()), 0.2);
    if (typeof value === 'number') return finitePositive(value, 0.2);
    return 0.2;
}

export function roundVnd(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.ceil(value / 1000) * 1000;
}

export function calculatePrintingPrice(input: PrintingPriceInput): PrintingPriceBreakdown {
    const technology: PrintTechnology = input.technology === 'resin' ? 'resin' : 'fdm';
    const grams = Math.max(0, Number(input.grams) || 0);
    const timeHours = Math.max(0, Number(input.timeHours) || 0);
    const quantity = Math.max(1, Math.round(Number(input.quantity) || 1));
    const infillRatio = normalizeInfill(input.infill);
    const layerHeightMm = normalizeLayerHeight(input.layerHeight);

    const baseMaterialCost = technology === 'fdm' ? grams * 600 : grams * 6500;
    const baseMachineCost = technology === 'fdm'
        ? 4000 * timeHours * 0.3 * (0.2 / layerHeightMm)
        : 4000 * timeHours * 0.3;
    const infillMultiplier = technology === 'fdm' ? infillRatio / 0.2 : 1;
    const materialCost = baseMaterialCost * infillMultiplier;
    const machineCost = baseMachineCost * infillMultiplier;
    const subtotal = (materialCost + machineCost) * quantity;

    return {
        technology,
        grams,
        timeHours,
        infillRatio,
        layerHeightMm,
        quantity,
        baseMaterialCost: Math.round(baseMaterialCost),
        baseMachineCost: Math.round(baseMachineCost),
        infillMultiplier,
        materialCost: Math.round(materialCost * quantity),
        machineCost: Math.round(machineCost * quantity),
        subtotal: Math.round(subtotal),
        total: roundVnd(subtotal),
        formulaVersion: PRINTING_PRICE_FORMULA_VERSION,
    };
}
