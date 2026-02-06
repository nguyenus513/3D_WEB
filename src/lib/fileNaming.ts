/**
 * File Naming Conventions for 3D_Web Orders
 * 
 * Custom Orders (HEX):
 *   User photos: {orderCode}-{x}.{y}.{z}.{ext}
 *     x: 1=single, 2=couple, 3+=group
 *     y: 1=main, 2=accessory
 *     z: photo sequence (1,2,3...)
 *   Admin review: {orderCode}-0.{b}.{ext}
 *     0=admin review, b=sequence
 * 
 * Printing Orders (HEX):
 *   Resin: {orderCode}-1.{n}.{ext}
 *     n=file sequence
 *   FDM: {orderCode}-2.{n}.{p}.{q}.{r}.{ext}
 *     n=file sequence
 *     p=infill (15/20/30/50)
 *     q=layer (20=0.2mm, 12=0.12mm, 08=0.08mm)
 *     r=color (1=white, 2=black)
 */

export type CustomType = 'single' | 'couple' | 'group';
export type PhotoCategory = 'main' | 'accessory';
export type PrintTech = 'resin' | 'fdm';
export type FDMColor = 'white' | 'black' | 'transparent';

interface CustomFileParams {
    orderCode: string;
    customType: CustomType;
    personCount?: number;
    photoCategory: PhotoCategory;
    photoIndex: number;
    extension: string;
}

interface PrintingFileParams {
    orderCode: string;
    tech: PrintTech;
    fileIndex: number;
    infill?: number;      // 15, 20, 30, 50
    layerHeight?: string; // '0.2', '0.12', '0.08'
    color?: FDMColor;
    extension: string;
}

interface ReviewFileParams {
    orderCode: string;
    index: number;
    extension: string;
}

// Map custom type to x value
function getCustomTypeCode(type: CustomType, personCount?: number): number {
    switch (type) {
        case 'single': return 1;
        case 'couple': return 2;
        case 'group': return personCount && personCount > 2 ? personCount : 3;
        default: return 1;
    }
}

// Map photo category to y value
function getPhotoCategoryCode(category: PhotoCategory): number {
    return category === 'main' ? 1 : 2;
}

// Map layer height to code
function getLayerCode(layerHeight: string): string {
    switch (layerHeight) {
        case '0.2': return '20';
        case '0.12': return '12';
        case '0.08': return '08';
        default: return '20';
    }
}

// Map color to code
function getColorCode(color: FDMColor): number {
    switch (color) {
        case 'white': return 1;
        case 'black': return 2;
        case 'transparent': return 3;
        default: return 1;
    }
}

/**
 * Generate file name for Custom order user uploads
 * Example: A1B2C3D4E5-2.1.1.jpg
 */
export function generateCustomFileName(params: CustomFileParams): string {
    const { orderCode, customType, personCount, photoCategory, photoIndex, extension } = params;
    const x = getCustomTypeCode(customType, personCount);
    const y = getPhotoCategoryCode(photoCategory);
    const z = photoIndex;
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    return `${orderCode}-${x}.${y}.${z}${ext}`;
}

/**
 * Generate file name for Printing order uploads
 * Resin: A1B2C3D4E5-1.1.stl
 * FDM: A1B2C3D4E5-2.1.20.20.1.stl
 */
export function generatePrintingFileName(params: PrintingFileParams): string {
    const { orderCode, tech, fileIndex, infill, layerHeight, color, extension } = params;
    const ext = extension.startsWith('.') ? extension : `.${extension}`;

    if (tech === 'resin') {
        // Resin: {orderCode}-1.{n}.{ext}
        return `${orderCode}-1.${fileIndex}${ext}`;
    } else {
        // FDM: {orderCode}-2.{n}.{p}.{q}.{r}.{ext}
        const p = infill || 20;
        const q = getLayerCode(layerHeight || '0.2');
        const r = getColorCode(color || 'white');
        return `${orderCode}-2.${fileIndex}.${p}.${q}.${r}${ext}`;
    }
}

/**
 * Generate file name for Admin review/demo uploads
 * Example: A1B2C3D4E5-0.1.jpg
 */
export function generateReviewFileName(params: ReviewFileParams): string {
    const { orderCode, index, extension } = params;
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    return `${orderCode}-0.${index}${ext}`;
}

/**
 * Get folder path for order files in R2/Drive
 */
export function getOrderFolderPath(orderCode: string): string {
    return `orders/${orderCode}`;
}

/**
 * Parse file name back to components (for verification/display)
 */
export function parseFileName(fileName: string): {
    orderCode: string;
    type: 'custom' | 'printing' | 'review';
    params: Record<string, number | string>;
} | null {
    // Remove extension
    const parts = fileName.split('.');
    const ext = parts.pop();
    const baseName = parts.join('.');

    // Split by dash to get order code and params
    const dashParts = baseName.split('-');
    if (dashParts.length < 2) return null;

    // Order code is everything before the last dash-separated numeric part
    const lastPart = dashParts.pop()!;
    const orderCode = dashParts.join('-');

    // Parse the numeric parts
    const numParts = lastPart.split('.').map(p => parseInt(p, 10) || p);

    if (numParts[0] === 0) {
        // Admin review
        return {
            orderCode,
            type: 'review',
            params: { index: numParts[1] as number }
        };
    } else if (numParts[0] === 1) {
        // Resin printing
        return {
            orderCode,
            type: 'printing',
            params: { tech: 'resin', fileIndex: numParts[1] as number }
        };
    } else if (numParts[0] === 2 && numParts.length >= 5) {
        // FDM printing
        return {
            orderCode,
            type: 'printing',
            params: {
                tech: 'fdm',
                fileIndex: numParts[1] as number,
                infill: numParts[2] as number,
                layer: numParts[3],
                color: numParts[4] as number
            }
        };
    } else {
        const firstPart = typeof numParts[0] === 'number' ? numParts[0] : 0;
        if (firstPart >= 1 && firstPart <= 10) {
            // Custom order
            return {
                orderCode,
                type: 'custom',
                params: {
                    customType: numParts[0] as number,
                    photoCategory: numParts[1] as number,
                    photoIndex: numParts[2] as number
                }
            };
        }
    }

    return null;
}
