import { getAdminSupabase } from '@/lib/supabase/admin';

export interface CustomPricingType {
    type: 'single' | 'couple' | 'group';
    label: string;
    base_price: number;
    deposit_percent: number;
}

export interface CustomPricingSize {
    size_code: string;
    label: string;
    multiplier: number;
}

export interface PrintingPricing {
    print_type: 'fdm' | 'resin';
    label: string;
    density: number;
    speed: number;
    shell_factor: number;
    resin_factor: number;
    deposit_percent: number;
    rate_gram: number;
    rate_hour: number;
    infill_factors: Record<string, number>;
    layer_multipliers: Record<string, number>;
    colors: Array<{ id: string; name: string; hex: string }>;
}

export async function fetchCustomPricing() {
    const supabase = getAdminSupabase();
    const [typesRes, sizesRes] = await Promise.all([
        supabase.from('pricing_custom_types').select('*'),
        supabase.from('pricing_custom_sizes').select('*'),
    ]);

    if (typesRes.error) throw typesRes.error;
    if (sizesRes.error) throw sizesRes.error;

    return {
        types: (typesRes.data || []) as CustomPricingType[],
        sizes: (sizesRes.data || []) as CustomPricingSize[],
    };
}

export async function fetchPrintingPricing() {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase.from('pricing_printing').select('*');
    if (error) throw error;
    return (data || []) as PrintingPricing[];
}

export function calculateCustomPrice(
    pricing: { types: CustomPricingType[]; sizes: CustomPricingSize[] },
    type: 'single' | 'couple' | 'group',
    sizeCode: string
) {
    const typeRow = pricing.types.find((t) => t.type === type);
    const sizeRow = pricing.sizes.find((s) => s.size_code === sizeCode);
    const base = typeRow?.base_price ?? 0;
    const multiplier = sizeRow?.multiplier ?? 1;
    const total = Math.round(base * multiplier);
    const depositPercent = typeRow?.deposit_percent ?? 50;
    const depositAmount = Math.round(total * (depositPercent / 100));
    return { total, depositAmount, depositPercent };
}

function getInfillRatio(infill: string, map: Record<string, number>): number {
    const normalized = infill.replace('%', '');
    return map[infill] ?? map[`${normalized}%`] ?? map[normalized] ?? 0.2;
}

function getLayerMultiplier(layer: string, map: Record<string, number>): number {
    return map[layer] ?? 1;
}

export function calculatePrintingMetrics(params: {
    volumeCm3: number;
    printType: 'fdm' | 'resin';
    infill: string;
    layerHeight: string;
    pricing: PrintingPricing;
}) {
    const { volumeCm3, printType, infill, layerHeight, pricing } = params;
    const density = pricing.density;
    let grams = 0;

    if (printType === 'fdm') {
        const infillRatio = getInfillRatio(infill, pricing.infill_factors || {});
        const vIn = volumeCm3 * (pricing.shell_factor + infillRatio);
        grams = vIn * density;
    } else {
        const vReal = volumeCm3 * pricing.resin_factor;
        grams = vReal * density;
    }

    const speed = pricing.speed;
    let hours = grams / speed;
    if (printType === 'fdm') {
        hours = hours * getLayerMultiplier(layerHeight, pricing.layer_multipliers || {});
    }

    const price = pricing.rate_gram * grams + pricing.rate_hour * hours;

    return {
        grams: Math.round(grams),
        hours: Math.round(hours * 10) / 10,
        price: Math.round(price),
    };
}

