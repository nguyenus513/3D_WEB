/**
 * Order Storage Paths
 *
 * Required format:
 * {customerCode}/YYYY-MM-DD/{orderCode}/{fileType}/filename
 *
 * fileType subfolders:
 * - custom/main
 * - custom/accessory
 * - custom/preview
 * - printing/fdm
 * - printing/resin
 * - review
 */

export type OrderFileCategory =
    | 'custom_main'
    | 'custom_accessory'
    | 'custom_preview'
    | 'printing_fdm'
    | 'printing_resin'
    | 'review'
    | 'product';

const CATEGORY_PATH: Record<OrderFileCategory, string> = {
    custom_main: 'custom/main',
    custom_accessory: 'custom/accessory',
    custom_preview: 'custom/preview',
    printing_fdm: 'printing/fdm',
    printing_resin: 'printing/resin',
    review: 'review',
    product: 'product',
};

export function getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
}

function sanitizeSegment(segment: string): string {
    return (segment || '')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toUpperCase();
}

function sanitizeFileName(name: string): string {
    return name.replace(/[/\\]/g, '_').replace(/\0/g, '');
}

export function getCategoryPath(category: OrderFileCategory): string {
    return CATEGORY_PATH[category];
}

export function buildOrderPathSegments(params: {
    customerCode: string;
    orderCode: string;
    category: OrderFileCategory;
    date?: string;
}): string[] {
    const date = params.date || getTodayDate();
    const customer = sanitizeSegment(params.customerCode || 'GUEST');
    const order = sanitizeSegment(params.orderCode);
    const categoryPath = getCategoryPath(params.category).split('/');
    return [customer, date, order, ...categoryPath];
}

export function buildOrderStorageKey(params: {
    customerCode: string;
    orderCode: string;
    category: OrderFileCategory;
    fileName: string;
    date?: string;
}): string {
    const segments = buildOrderPathSegments(params);
    const fileName = sanitizeFileName(params.fileName);
    return [...segments, fileName].join('/');
}

export function parseOrderStorageKey(key: string): {
    customerCode: string;
    date: string;
    orderCode: string;
    category: OrderFileCategory;
    fileName: string;
} | null {
    const parts = key.split('/');
    if (parts.length < 4) return null;

    const [customerCode, date, orderCode, type1, type2, ...rest] = parts;
    let category: OrderFileCategory | null = null;

    if (type1 === 'custom' && type2 === 'main') category = 'custom_main';
    else if (type1 === 'custom' && type2 === 'accessory') category = 'custom_accessory';
    else if (type1 === 'custom' && type2 === 'preview') category = 'custom_preview';
    else if (type1 === 'printing' && type2 === 'fdm') category = 'printing_fdm';
    else if (type1 === 'printing' && type2 === 'resin') category = 'printing_resin';
    else if (type1 === 'review') {
        category = 'review';
    } else if (type1 === 'product') {
        category = 'product';
    }

    if (!category) return null;

    const fileName = (type1 === 'review' || type1 === 'product')
        ? [type2, ...rest].join('/')
        : rest.join('/');

    return {
        customerCode,
        date,
        orderCode,
        category,
        fileName,
    };
}

export function extractOrderCodeFromKey(key: string): string | null {
    const parts = key.split('/');
    if (parts.length < 3) return null;
    const orderCode = parts[2];
    return orderCode || null;
}
