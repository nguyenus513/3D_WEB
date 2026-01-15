import { customAlphabet } from 'nanoid';

/**
 * Custom alphabet for ID generation
 * Excludes I, O to avoid confusion with 1, 0
 */
const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// Pre-configured generators with specific lengths
const generator6 = customAlphabet(ALPHABET, 6);
const generator8 = customAlphabet(ALPHABET, 8);

/**
 * Generate unique IDs for different entities
 * Using NanoID with custom alphabet for collision-resistant random IDs
 * 
 * Collision probability with 6 chars (34^6 = 1.5B combinations):
 * - 100K items: ~0.3% chance of collision
 * - Always verify uniqueness in DB before insert
 */
export const generateId = {
    /**
     * Generate Order ID: ORD-XXXXXX
     * @example ORD-A7K3M9
     */
    order: (): string => `ORD-${generator6()}`,

    /**
     * Generate Product ID: PRD-XXXXXX
     * @example PRD-B2N8P4
     */
    product: (): string => `PRD-${generator6()}`,

    /**
     * Generate Customer ID: CUS-XXXXXX
     * @example CUS-K5J2H8
     */
    customer: (): string => `CUS-${generator6()}`,

    /**
     * Generate 3D Printing Request ID: PRT-XXXXXX
     * @example PRT-M4R7S2
     */
    printing: (): string => `PRT-${generator6()}`,

    /**
     * Generate Custom Order ID: CST-XXXXXX
     * @example CST-N9L3K6
     */
    custom: (): string => `CST-${generator6()}`,

    /**
     * Generate SKU with optional category prefix
     * @param category Optional category prefix (e.g., 'DRG' for Dragon)
     * @example SKU-A7K3M9B2 or DRG-A7K3M9B2
     */
    sku: (category?: string): string => {
        const code = generator8();
        return category ? `${category.toUpperCase()}-${code}` : `SKU-${code}`;
    },

    /**
     * Generate raw code without prefix (for custom use)
     * @param length Code length (default: 6)
     */
    raw: (length: 6 | 8 = 6): string => {
        return length === 6 ? generator6() : generator8();
    },
};

/**
 * Validate ID format
 */
export const validateId = {
    order: (id: string): boolean => /^ORD-[0-9A-HJ-NP-Z]{6}$/.test(id),
    product: (id: string): boolean => /^PRD-[0-9A-HJ-NP-Z]{6}$/.test(id),
    customer: (id: string): boolean => /^CUS-[0-9A-HJ-NP-Z]{6}$/.test(id),
    printing: (id: string): boolean => /^PRT-[0-9A-HJ-NP-Z]{6}$/.test(id),
    custom: (id: string): boolean => /^CST-[0-9A-HJ-NP-Z]{6}$/.test(id),
    sku: (id: string): boolean => /^[A-Z]{3}-[0-9A-HJ-NP-Z]{8}$/.test(id),
};

export default generateId;
