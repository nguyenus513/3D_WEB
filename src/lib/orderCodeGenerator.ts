/**
 * Order Code Generator - Pure Hex Format
 * 
 * All codes are uppercase hexadecimal (0-9, A-F):
 * - Customer Code: 10 hex random
 * - Parent Code: 8 hex random  
 * - Child Code: parentCode + 4 hex = 12 total
 * - Transfer Content: customerCode + parentCode = 18 chars
 */

const HEX_CHARS = '0123456789ABCDEF';

/**
 * Generate random hex string of specified length
 */
export function generateHex(length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += HEX_CHARS.charAt(Math.floor(Math.random() * HEX_CHARS.length));
    }
    return result;
}

/**
 * Generate customer code (10 hex)
 * Format: XXXXXXXXXX (10 chars)
 * 
 * @example
 * generateCustomerCode() // "A1B2C3D4E5"
 */
export function generateCustomerCode(): string {
    return generateHex(10);
}

/**
 * Generate parent/cart code (8 hex)
 * Format: XXXXXXXX (8 chars)
 * 
 * @example
 * generateParentCode() // "F6A7B8C9"
 */
export function generateParentCode(): string {
    return generateHex(8);
}

/**
 * Generate child/product code (16 hex = parent 8 + suffix 8)
 * Format: {parentCode}{8 hex suffix} (16 chars total)
 * 
 * @param parentCode - The 8-char parent code
 * @param skuSuffix - Optional 8-char hex suffix (e.g. from product SKU)
 * @example
 * generateChildCode("F6A7B8C9") // "F6A7B8C9D0E1F2A3"
 * generateChildCode("F6A7B8C9", "0A1B2C3D") // "F6A7B8C90A1B2C3D"
 */
export function generateChildCode(parentCode: string, skuSuffix?: string): string {
    const suffix = (skuSuffix && isValidHex(skuSuffix) && skuSuffix.length === 8)
        ? skuSuffix
        : generateHex(8);
    return `${parentCode}${suffix}`;
}

/**
 * Generate transfer content for QR payment
 * Format: {customerCode}{parentCode} (18 chars total)
 * 
 * @param customerCode - The 10-char customer code
 * @param parentCode - The 8-char parent code
 * @example
 * generateTransferContent("A1B2C3D4E5", "F6A7B8C9")
 * // Returns: "A1B2C3D4E5F6A7B8C9"
 */
export function generateTransferContent(
    customerCode: string,
    parentCode: string
): string {
    return `${customerCode}${parentCode}`;
}

/**
 * Parse transfer content back to components
 * 
 * @param transferContent - 18-char transfer content
 * @returns { customerCode, parentCode } or null if invalid
 */
export function parseTransferContent(transferContent: string): {
    customerCode: string;
    parentCode: string;
} | null {
    if (!transferContent || transferContent.length !== 18) {
        return null;
    }

    return {
        customerCode: transferContent.slice(0, 10),
        parentCode: transferContent.slice(10, 18),
    };
}

/**
 * Extract parent code from child code
 * 
 * @param childCode - 16-char child code
 * @returns 8-char parent code or null if invalid
 */
export function extractParentCode(childCode: string): string | null {
    if (!childCode || childCode.length !== 16) {
        return null;
    }
    return childCode.slice(0, 8);
}

/**
 * Validate if string is valid hex
 */
export function isValidHex(str: string): boolean {
    if (!str) return false;
    return /^[0-9A-F]+$/i.test(str);
}

/**
 * Validate customer code (10 hex)
 */
export function isValidCustomerCode(code: string): boolean {
    return code?.length === 10 && isValidHex(code);
}

/**
 * Validate parent code (8 hex)
 */
export function isValidParentCode(code: string): boolean {
    return code?.length === 8 && isValidHex(code);
}

/**
 * Validate child code (16 hex)
 */
export function isValidChildCode(code: string): boolean {
    return code?.length === 16 && isValidHex(code);
}
