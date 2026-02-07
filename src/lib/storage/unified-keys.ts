/**
 * Unified Storage Keys (Hex ID Edition)
 *
 * Provides consistent naming convention for both R2 and Google Drive storage.
 *
 * Key Format: {customerCode}/{timestamp}/{parentOrderCode}/{childOrderCode}-{type}.{index}.{ext}
 *
 * Examples (Pure Hex IDs):
 * - Printing FDM: 9CF293891B/2026-01-31/A1B2C3D4E5F6/F1E2D3C4B5-fdm.1.stl
 * - Custom Main: 9CF293891B/2026-01-31/A1B2C3D4E5F6/F1E2D3C4B5-main.1.jpg
 * - Review: 9CF293891B/2026-01-31/A1B2C3D4E5F6/review/F1E2D3C4B5-0.1.jpg
 * - Product: products/A7B3C9D1/A7B3C9D1_01.jpg
 */

// =============================================================================
// Types
// =============================================================================

export type FileType = 'main' | 'acc' | 'fdm' | 'resin' | 'review' | 'product';

// NEW: Order-centric storage types (Production-Ready)
// Categories aligned with order_files.category in database
export type OrderFileCategory = 'models' | 'images' | 'review' | 'docs' | 'reference';

export interface OrderCentricKeyParams {
    orderCode: string;           // Hex order code (e.g., 4A1B9C2D8E3F)
    fileName: string;            // Original or generated filename
    category?: OrderFileCategory; // File category for organization
}

export interface TempStorageKeyParams {
    sessionId: string;           // Session or upload token
    fileName: string;            // Original filename
}

// Legacy types (preserved for backward compatibility)
export interface StorageKeyParams {
    customerCode: string;       // CUS-001
    timestamp?: string;         // YYYY-MM-DD (auto-generated if not provided)
    parentOrderCode?: string;   // MST-001 (Optional, defaults to childOrderCode if missing)
    childOrderCode: string;     // P3D-001 or FIG-001
    fileType: FileType;
    index: number;
    ext: string;
}

export interface ProductKeyParams {
    sku: string;
    index: number;
    ext: string;
    variant?: 'size';
}

export interface ParsedKey {
    customerCode: string;
    timestamp: string;
    parentOrderCode: string;
    childOrderCode: string;
    fileType: FileType;
    index: number;
    ext: string;
    isReview: boolean;
    isProduct: boolean;
}

// =============================================================================
// Key Generation
// =============================================================================

/**
 * Generate unified storage key for customer orders
 *
 * @example
 * generateUnifiedKey({
 *   customerCode: 'CUS-001',
 *   parentOrderCode: 'MST-001',
 *   childOrderCode: 'P3D-001',
 *   fileType: 'fdm',
 *   index: 1,
 *   ext: 'stl'
 * })
 * // => 'CUS-001/2026-01-31/MST-001/P3D-001-fdm.1.stl'
 */
export function generateUnifiedKey(params: StorageKeyParams): string {
    const {
        customerCode,
        timestamp = getTodayTimestamp(),
        parentOrderCode,
        childOrderCode,
        fileType,
        index,
        ext,
    } = params;

    // Sanitize inputs (Hex safety)
    const safeCustomerCode = sanitizeSegment(customerCode || 'GUEST');
    const safeChildCode = sanitizeSegment(childOrderCode);
    const safeParentCode = parentOrderCode ? sanitizeSegment(parentOrderCode) : safeChildCode;
    const safeExt = ext.replace(/^\./, '').toLowerCase();

    // Review files go in review subfolder
    if (fileType === 'review') {
        return `${safeCustomerCode}/${timestamp}/${safeParentCode}/review/${safeChildCode}-0.${index}.${safeExt}`;
    }

    return `${safeCustomerCode}/${timestamp}/${safeParentCode}/${safeChildCode}-${fileType}.${index}.${safeExt}`;
}

// =============================================================================
// NEW: Order-Centric Key Generation (Production-Ready)
// =============================================================================

/**
 * Generate order-centric storage key (Privacy-First)
 *
 * Path Format: orders/{orderCode}/{fileName}
 *
 * Benefits:
 * - No user ID exposure in URLs
 * - Professional shareable links
 * - Easy order-based file grouping
 *
 * @example
 * generateOrderCentricKey({
 *   orderCode: '4A1B9C2D8E3F',
 *   fileName: 'model.stl',
 *   category: 'model'
 * })
 * // => 'orders/4A1B9C2D8E3F/model.stl'
 */
export function generateOrderCentricKey(params: OrderCentricKeyParams): string {
    const { orderCode, fileName, category } = params;

    // Sanitize order code (must be valid Hex)
    const safeOrderCode = orderCode.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    if (safeOrderCode.length < 8) {
        throw new Error('Invalid order code: must be at least 8 hex characters');
    }

    // Sanitize filename
    const safeFileName = sanitizeFileName(fileName);

    // Optional category subfolder
    if (category) {
        return `orders/${safeOrderCode}/${category}/${safeFileName}`;
    }

    return `orders/${safeOrderCode}/${safeFileName}`;
}

/**
 * Generate temp storage key for pre-checkout uploads
 *
 * Path Format: temp/{sessionId}/{fileName}
 *
 * Files in temp/ should be auto-deleted after 24h via R2 lifecycle rules.
 *
 * @example
 * generateTempKey({
 *   sessionId: 'sess_abc123',
 *   fileName: 'design.stl'
 * })
 * // => 'temp/sess_abc123/design.stl'
 */
export function generateTempKey(params: TempStorageKeyParams): string {
    const { sessionId, fileName } = params;

    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const safeFileName = sanitizeFileName(fileName);

    return `temp/${safeSessionId}/${safeFileName}`;
}

/**
 * Get folder path for order-centric storage
 */
export function getOrderFolderPath(orderCode: string): string {
    const safeOrderCode = orderCode.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    return `orders/${safeOrderCode}`;
}

/**
 * Sanitize filename to be URL-safe
 */
function sanitizeFileName(fileName: string): string {
    // Extract extension
    const lastDot = fileName.lastIndexOf('.');
    const name = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
    const ext = lastDot > 0 ? fileName.slice(lastDot + 1).toLowerCase() : '';

    // Sanitize name part
    const safeName = name
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 100);

    return ext ? `${safeName}.${ext}` : safeName;
}

/**
 * Generate storage key for product images (permanent, no timestamp)
 *
 * @example
 * generateProductKey({ sku: 'FIG-001', index: 1, ext: 'jpg' })
 * // => 'products/FIG-001/FIG-001_01.jpg'
 * 
 * generateProductKey({ sku: 'FIG-001', index: 1, ext: 'jpg', variant: 'size' })
 * // => 'products/FIG-001/sizes/FIG-001_size_01.jpg'
 */
export function generateProductKey(params: ProductKeyParams): string {
    const { sku, index, ext, variant } = params;
    const safeSku = sanitizeSegment(sku);
    const safeExt = ext.replace(/^\./, '').toLowerCase();
    const paddedIndex = String(index).padStart(2, '0');

    if (variant === 'size') {
        return `products/${safeSku}/sizes/${safeSku}_size_${paddedIndex}.${safeExt}`;
    }

    return `products/${safeSku}/${safeSku}_${paddedIndex}.${safeExt}`;
}

// =============================================================================
// Key Parsing
// =============================================================================

/**
 * Parse a unified storage key back to components
 */
export function parseUnifiedKey(key: string): ParsedKey | null {
    // Product key: products/{sku}/{filename}
    const productMatch = key.match(/^products\/([^/]+)\/(.+)$/);
    if (productMatch) {
        const [, sku, filename] = productMatch;
        const fileMatch = filename.match(/^(.+)_(\d+)\.(\w+)$/);
        if (fileMatch) {
            return {
                customerCode: '',
                timestamp: '',
                parentOrderCode: '',
                childOrderCode: sku,
                fileType: 'product',
                index: parseInt(fileMatch[2], 10),
                ext: fileMatch[3],
                isReview: false,
                isProduct: true,
            };
        }
    }

    // Order key: {customer}/{timestamp}/{parent}/{child}-{type}.{index}.{ext}
    const orderMatch = key.match(
        /^([^/]+)\/(\d{4}-\d{2}-\d{2})\/([^/]+)\/(?:review\/)?([^-]+)-([^.]+)\.(\d+)\.(\w+)$/
    );
    if (orderMatch) {
        const [, customerCode, timestamp, parentOrderCode, childOrderCode, fileType, indexStr, ext] =
            orderMatch;
        return {
            customerCode,
            timestamp,
            parentOrderCode,
            childOrderCode,
            fileType: fileType as FileType,
            index: parseInt(indexStr, 10),
            ext,
            isReview: key.includes('/review/'),
            isProduct: false,
        };
    }

    return null;
}

// =============================================================================
// Folder Paths
// =============================================================================

/**
 * Get folder path segments for Drive upload
 */
export function getFolderPath(params: StorageKeyParams): string[] {
    const {
        customerCode,
        timestamp = getTodayTimestamp(),
        parentOrderCode,
        childOrderCode,
        fileType,
    } = params;

    const safeCustomerCode = sanitizeSegment(customerCode || 'GUEST');
    const safeParentCode = parentOrderCode
        ? sanitizeSegment(parentOrderCode)
        : sanitizeSegment(childOrderCode || 'UNKNOWN');

    if (fileType === 'review') {
        return [safeCustomerCode, timestamp, safeParentCode, 'review'];
    }

    return [safeCustomerCode, timestamp, safeParentCode];
}

/**
 * Get folder path for product images
 */
export function getProductFolderPath(sku: string): string[] {
    return ['products', sanitizeSegment(sku)];
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Get today's date as YYYY-MM-DD
 */
export function getTodayTimestamp(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Sanitize path segment to be URL-safe
 */
function sanitizeSegment(segment: string): string {
    return segment
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toUpperCase();
}

/**
 * Extract file extension from filename
 */
export function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : 'jpg';
}

/**
 * Generate filename from key components
 */
export function generateFileName(params: StorageKeyParams | ProductKeyParams): string {
    if ('sku' in params) {
        // Product
        const paddedIndex = String(params.index).padStart(2, '0');
        return `${params.sku}_${paddedIndex}.${params.ext}`;
    }

    // Order file
    const { childOrderCode, fileType, index, ext } = params as StorageKeyParams;
    if (fileType === 'review') {
        return `${childOrderCode}-0.${index}.${ext}`;
    }
    return `${childOrderCode}-${fileType}.${index}.${ext}`;
}

// =============================================================================
// Path Extraction from R2 Key
// =============================================================================

/**
 * Extract customer folder prefix from key (for cleanup)
 */
export function getCustomerPrefix(key: string): string | null {
    const parsed = parseUnifiedKey(key);
    if (!parsed || parsed.isProduct) return null;

    return `${parsed.customerCode}/${parsed.timestamp}/${parsed.parentOrderCode}/`;
}

/**
 * Check if key is a product key (permanent, no migration)
 */
export function isProductKey(key: string): boolean {
    return key.startsWith('products/');
}

/**
 * Check if key is a review/demo image
 */
export function isReviewKey(key: string): boolean {
    return key.includes('/review/');
}
