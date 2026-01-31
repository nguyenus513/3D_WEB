import { generateHexCode } from './utils/generateHexCode';

/**
 * ID Format Specification (NEW - Hex Only)
 * 
 * | Entity           | Format        | Example      | Length |
 * |------------------|---------------|--------------|--------|
 * | Custom Order     | Hex String    | 9CF293891B   | 10     |
 * | Product Order    | Hex String    | B2N8P4K5...  | 10     |
 * | 3D Printing      | Hex String    | M4R7S2N9...  | 10     |
 * | User Code        | Hex String    | K5J2H8M4...  | 10     |
 * | Master Order     | Hex String    | A1B2C3D4E5F6 | 12     |
 * | Product SKU      | Hex String    | A7B3C9D1     | 8      |
 * 
 * Format: Uppercase Hex string (0-9, A-F)
 */

/**
 * Generate unique IDs for different entities
 */
export const generateId = {
    /**
     * Generate Custom Order ID: 10 chars Hex
     * @example 9CF293891B
     */
    custom: (): string => generateHexCode(10),

    /**
     * Generate Product Order ID: 10 chars Hex
     * @example B2N8P4K5AB
     */
    product: (): string => generateHexCode(10),

    /**
     * Generate 3D Printing Order ID: 10 chars Hex
     * @example M4R7S2N9CD
     */
    printing: (): string => generateHexCode(10),

    /**
     * Generate User Code: 10 chars Hex
     * @example K5J2H8M4EF
     */
    user: (): string => generateHexCode(10),

    /**
     * Generate Admin Code: 10 chars Hex
     * @example N9L3K6A7GH
     */
    admin: (): string => generateHexCode(10),

    /**
     * Generate Product SKU: 8 chars Hex
     * @example A7B3C9D1
     */
    sku: (): string => generateHexCode(8),

    /**
     * Generate Master Order ID: 12 chars Hex
     * @example A1B2C3D4E5F6
     */
    master: (): string => generateHexCode(12),

    /**
     * Alias for user() - backward compatibility
     */
    customer: (): string => generateHexCode(10),

    /**
     * Alias for product() - for cart/checkout flow
     */
    order: (): string => generateHexCode(10),

    /**
     * Generate raw code
     */
    raw: (length = 10): string => generateHexCode(length),
};

/**
 * Validate ID format (Hex codes)
 */
export const validateId = {
    // 10 chars Hex
    custom: (id: string): boolean => /^[0-9A-F]{10}$/.test(id),
    product: (id: string): boolean => /^[0-9A-F]{10}$/.test(id),
    printing: (id: string): boolean => /^[0-9A-F]{10}$/.test(id),
    user: (id: string): boolean => /^[0-9A-F]{10}$/.test(id),
    admin: (id: string): boolean => /^[0-9A-F]{10}$/.test(id),

    // 8 chars Hex
    sku: (id: string): boolean => /^[0-9A-F]{8}$/.test(id),

    // 12 chars Hex
    master: (id: string): boolean => /^[0-9A-F]{12}$/.test(id),

    // Generic
    any: (id: string): boolean => /^[0-9A-F]+$/.test(id),
};

/**
 * Extract order type from ID - DEPRECATED
 * With pure hex IDs, we cannot determine type solely from ID string.
 * This function checks length as a best-effort heuristic.
 */
export const getOrderTypeFromId = (id: string): 'custom' | 'product' | 'printing' | 'master' | 'unknown' => {
    if (/^[0-9A-F]{12}$/.test(id)) return 'master';
    // 10 char IDs are ambiguous between custom, product, printing
    return 'unknown';
};

export default generateId;

