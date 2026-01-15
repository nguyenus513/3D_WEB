import { customAlphabet } from 'nanoid';

/**
 * Custom alphabet for ID generation
 * Excludes I, O to avoid confusion with 1, 0
 * 
 * With 10 chars (34^10 = 2.06 quadrillion combinations):
 * - Virtually zero collision probability
 * - Still verify uniqueness in DB for safety
 */
const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// Pre-configured generators with specific lengths
const generator10 = customAlphabet(ALPHABET, 10);

/**
 * Generate unique IDs for different entities
 * Using NanoID with custom alphabet for collision-resistant random IDs
 * All IDs are 10 characters for consistency and maximum uniqueness
 */
export const generateId = {
    /**
     * Generate Order ID: ORD-XXXXXXXXXX
     * @example ORD-A7K3M9B2N8
     */
    order: (): string => `ORD-${generator10()}`,

    /**
     * Generate Product ID: PRD-XXXXXXXXXX
     * @example PRD-B2N8P4K5J2
     */
    product: (): string => `PRD-${generator10()}`,

    /**
     * Generate Customer ID: CUS-XXXXXXXXXX
     * @example CUS-K5J2H8M4R7
     */
    customer: (): string => `CUS-${generator10()}`,

    /**
     * Generate 3D Printing Request ID: PRT-XXXXXXXXXX
     * @example PRT-M4R7S2N9L3
     */
    printing: (): string => `PRT-${generator10()}`,

    /**
     * Generate Custom Order ID: CST-XXXXXXXXXX
     * @example CST-N9L3K6A7K3
     */
    custom: (): string => `CST-${generator10()}`,

    /**
     * Generate SKU for products: PRD-XXXXXXXXXX
     * @param category Optional category prefix (e.g., 'DRG' for Dragon)
     * @example PRD-A7K3M9B2N8 or DRG-A7K3M9B2N8
     */
    sku: (category?: string): string => {
        const code = generator10();
        return category ? `${category.toUpperCase()}-${code}` : `PRD-${code}`;
    },

    /**
     * Generate SKU for Resin 3D printing: RSN-XXXXXXXXXX
     * @example RSN-A7K3M9B2N8
     */
    skuResin: (): string => `RSN-${generator10()}`,

    /**
     * Generate SKU for FDM 3D printing: FDM-XXXXXXXXXX
     * @example FDM-B2N8P4C5K6
     */
    skuFdm: (): string => `FDM-${generator10()}`,

    /**
     * Generate SKU for Custom orders: CST-XXXXXXXXXX
     * @example CST-K5J2H8M3N9
     */
    skuCustom: (): string => `CST-${generator10()}`,

    /**
     * Generate raw code without prefix (for custom use)
     * @example A7K3M9B2N8
     */
    raw: (): string => generator10(),
};

/**
 * Validate ID format (10 character codes)
 */
export const validateId = {
    order: (id: string): boolean => /^ORD-[0-9A-HJ-NP-Z]{10}$/.test(id),
    product: (id: string): boolean => /^PRD-[0-9A-HJ-NP-Z]{10}$/.test(id),
    customer: (id: string): boolean => /^CUS-[0-9A-HJ-NP-Z]{10}$/.test(id),
    printing: (id: string): boolean => /^PRT-[0-9A-HJ-NP-Z]{10}$/.test(id),
    custom: (id: string): boolean => /^CST-[0-9A-HJ-NP-Z]{10}$/.test(id),
    sku: (id: string): boolean => /^[A-Z]{3}-[0-9A-HJ-NP-Z]{10}$/.test(id),
};

export default generateId;
