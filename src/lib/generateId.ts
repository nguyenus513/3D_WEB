import { customAlphabet } from 'nanoid';

/**
 * ID Format Specification
 * 
 * | Entity           | Prefix | Format        | Example      |
 * |------------------|--------|---------------|--------------|
 * | Custom Order     | CUS    | CUS-XXXXXXXX  | CUS-A7K3M9B2 |
 * | Product Order    | PDC    | PDC-XXXXXXXX  | PDC-B2N8P4K5 |
 * | 3D Printing      | 3DP    | 3DP-XXXXXXXX  | 3DP-M4R7S2N9 |
 * | User Code        | USR    | USR-XXXXXXXX  | USR-K5J2H8M4 |
 * | Admin Code       | ADM    | ADM-XXXXXXXX  | ADM-N9L3K6A7 |
 * | Product SKU      | PRD    | PRD-XXXXXXXX  | PRD-A7K3M9B2 |
 * 
 * Format: 3-char prefix + hyphen + 8-char alphanumeric (total 12 chars)
 * Alphabet excludes I, O to avoid confusion with 1, 0
 */

const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// 8-character generator for all IDs
const generator8 = customAlphabet(ALPHABET, 8);

/**
 * Generate unique IDs for different entities
 */
export const generateId = {
    /**
     * Generate Custom Order ID: CUS-XXXXXXXX
     * @example CUS-A7K3M9B2
     */
    custom: (): string => `CUS-${generator8()}`,

    /**
     * Generate Product Order ID: PDC-XXXXXXXX
     * @example PDC-B2N8P4K5
     */
    product: (): string => `PDC-${generator8()}`,

    /**
     * Generate 3D Printing Order ID: 3DP-XXXXXXXX
     * @example 3DP-M4R7S2N9
     */
    printing: (): string => `3DP-${generator8()}`,

    /**
     * Generate User Code: USR-XXXXXXXX
     * @example USR-K5J2H8M4
     */
    user: (): string => `USR-${generator8()}`,

    /**
     * Generate Admin Code: ADM-XXXXXXXX
     * @example ADM-N9L3K6A7
     */
    admin: (): string => `ADM-${generator8()}`,

    /**
     * Generate Product SKU: 8 Hex Chars (Random)
     * @example A7B3C9D1
     */
    sku: (): string => customAlphabet('0123456789ABCDEF', 8)(),

    /**
     * Generate Master Order ID: ALL-XXXXXXXX
     * @example ALL-A7K3M9B2
     */
    master: (): string => `ALL-${generator8()}`,

    /**
     * Alias for user() - backward compatibility
     * @deprecated Use user() instead
     */
    customer: (): string => `USR-${generator8()}`,

    /**
     * Alias for product() - for cart/checkout flow
     * Used when ordering from product catalog
     */
    order: (): string => `PDC-${generator8()}`,

    /**
     * Generate raw code without prefix
     * @example A7K3M9B2
     */
    raw: (): string => generator8(),
};

/**
 * Validate ID format (8-char codes)
 */
export const validateId = {
    custom: (id: string): boolean => /^CUS-[0-9A-HJ-NP-Z]{8}$/.test(id),
    product: (id: string): boolean => /^PDC-[0-9A-HJ-NP-Z]{8}$/.test(id),
    printing: (id: string): boolean => /^3DP-[0-9A-HJ-NP-Z]{8}$/.test(id),
    user: (id: string): boolean => /^USR-[0-9A-HJ-NP-Z]{8}$/.test(id),
    admin: (id: string): boolean => /^ADM-[0-9A-HJ-NP-Z]{8}$/.test(id),
    // Validate SKU: 8 Hex Chars
    sku: (id: string): boolean => /^[0-9A-F]{8}$/.test(id),
    // Generic validation for any valid ID format
    any: (id: string): boolean => /^[A-Z0-9]{3}-[0-9A-HJ-NP-Z]{8}$/.test(id),
};

/**
 * Extract order type from ID prefix
 */
export const getOrderTypeFromId = (id: string): 'custom' | 'product' | 'printing' | 'unknown' => {
    if (id.startsWith('CUS-')) return 'custom';
    if (id.startsWith('PDC-')) return 'product';
    if (id.startsWith('3DP-')) return 'printing';
    return 'unknown';
};

export default generateId;
