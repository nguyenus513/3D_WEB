/**
 * Cloudflare R2 Storage Service
 * 
 * Hybrid Storage Flow:
 * - Product images: R2 (permanent, fast serving via Worker)
 * - Customer uploads (images): R2 → Drive after order complete
 * - STL/OBJ files: Direct to Google Drive
 */

import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2 Configuration
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'miniver3d';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // Should be Worker URL (e.g. cdn.miniver3d.com)

// Check if R2 is configured
export function isR2Configured(): boolean {
    return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

// Create S3 client for R2
function toAsciiMetadataValue(value: unknown): string {
    return Array.from(String(value ?? '').normalize('NFKD'))
        .map((char) => {
            const code = char.charCodeAt(0);
            if (code >= 0x0300 && code <= 0x036f) return '';
            if (code === 0x0d || code === 0x0a) return ' ';
            return code >= 0x20 && code <= 0x7e ? char : '_';
        })
        .join('')
        .slice(0, 1024);
}

function sanitizeR2Metadata(metadata?: Record<string, string>): Record<string, string> | undefined {
    if (!metadata) return undefined;

    return Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [
            key.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase(),
            toAsciiMetadataValue(value),
        ])
    );
}

function getR2Client(): S3Client {
    if (!isR2Configured()) {
        throw new Error('R2 not configured. Set CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
    }

    return new S3Client({
        region: 'auto',
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID!,
            secretAccessKey: R2_SECRET_ACCESS_KEY!,
        },
    });
}

/**
 * Upload types for storage routing
 */
export type UploadType = 'product' | 'printing' | 'custom_main' | 'custom_accessory' | 'custom_preview';

/**
 * Check if upload type should stay permanent on R2 (no migration)
 */
export function isPermanentOnR2(uploadType: UploadType): boolean {
    return uploadType === 'product';
}

/**
 * Determine storage destination based on file type and upload type
 * 
 * Strategy:
 * - Product images: R2 (permanent, public via Worker later)
 * - Customer uploads (custom/printing): Google Drive (has built-in public URLs)
 * - 3D models: Google Drive
 */
export function getStorageDestination(filename: string, uploadType: UploadType): 'r2' | 'drive' {
    const ext = filename.toLowerCase().split('.').pop() || '';

    // 3D models always go to Drive
    if (['stl', 'obj', '3mf'].includes(ext)) {
        return 'drive';
    }

    // Product images go to R2 (will be served via CDN Worker)
    if (uploadType === 'product') {
        return 'r2';
    }

    // Customer uploads go to Drive (has public thumbnail/view URLs)
    // This includes: custom_main, custom_accessory, custom_preview, printing
    return 'drive';
}

/**
 * Generate R2 key with proper folder structure (legacy)
 */
export function generateR2Key(
    uploadType: UploadType,
    identifier: string, // SKU for products, orderCode for orders
    filename: string,
    index?: number
): string {
    const timestamp = Date.now();
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const safeName = filename
        .toLowerCase()
        .replace(/\.[^.]+$/, '') // Remove extension
        .replace(/[^a-z0-9]/g, '_')
        .slice(0, 50);

    // Folder structure:
    // products/{sku}/{filename}
    // orders/{orderCode}/{filename}

    if (uploadType === 'product') {
        const indexSuffix = index ? `_${index}` : '';
        return `products/${identifier}/${safeName}${indexSuffix}_${timestamp}.${ext}`;
    }

    // Customer orders
    const typePrefix = uploadType.replace('custom_', '');
    return `orders/${identifier}/${typePrefix}_${timestamp}.${ext}`;
}

/**
 * NEW: Generate structured R2 key for Custom orders
 * Format: orders/{orderCode}/{orderCode}-{x}.{y}.{z}.{ext}
 */
export function generateCustomR2Key(
    orderCode: string,
    customType: 'single' | 'couple' | 'group',
    personCount: number,
    photoCategory: 'main' | 'accessory' | 'glasses' | 'hat' | 'model_image',
    photoIndex: number,
    extension: string
): string {
    const x = customType === 'single' ? 1 : customType === 'couple' ? 2 : Math.max(3, personCount);
    const categoryMap: Record<string, number> = { main: 1, accessory: 2, glasses: 3, hat: 4, model_image: 5 };
    const y = categoryMap[photoCategory] ?? 1;
    const ext = extension.startsWith('.') ? extension.slice(1) : extension;
    const fileName = `${orderCode}-${x}.${y}.${photoIndex}.${ext}`;
    return `orders/${orderCode}/${fileName}`;
}

/**
 * NEW: Generate structured R2 key for Printing orders  
 * Resin: orders/{orderCode}/{orderCode}-1.{n}.{ext}
 * FDM: orders/{orderCode}/{orderCode}-2.{n}.{p}.{q}.{r}.{ext}
 */
export function generatePrintingR2Key(
    orderCode: string,
    tech: 'resin' | 'fdm',
    fileIndex: number,
    infill?: number,      // 15, 20, 30, 50
    layerHeight?: string, // '0.2', '0.12', '0.08'
    color?: 'white' | 'black' | 'transparent',
    extension: string = 'stl'
): string {
    const ext = extension.startsWith('.') ? extension.slice(1) : extension;

    if (tech === 'resin') {
        const fileName = `${orderCode}-1.${fileIndex}.${ext}`;
        return `orders/${orderCode}/${fileName}`;
    } else {
        const p = infill || 20;
        const q = layerHeight === '0.12' ? '12' : layerHeight === '0.08' ? '08' : '20';
        const r = color === 'black' ? 2 : color === 'transparent' ? 3 : 1;
        const fileName = `${orderCode}-2.${fileIndex}.${p}.${q}.${r}.${ext}`;
        return `orders/${orderCode}/${fileName}`;
    }
}

/**
 * NEW: Generate structured R2 key for Admin review/demo images
 * Format: orders/{orderCode}/{orderCode}-0.{index}.{ext}
 */
export function generateReviewR2Key(
    orderCode: string,
    index: number,
    extension: string
): string {
    const ext = extension.startsWith('.') ? extension.slice(1) : extension;
    const fileName = `${orderCode}-0.${index}.${ext}`;
    return `orders/${orderCode}/${fileName}`;
}

/**
 * Upload file to R2
 * NOTE: For large files, prefer getPresignedUploadUrl() and upload from client
 */
export async function uploadToR2(
    file: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>
): Promise<{ url: string; key: string }> {
    const client = getR2Client();

    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: file,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000', // 1 year cache for images
        Metadata: sanitizeR2Metadata(metadata),
    });

    await client.send(command);

    // Return URL using Worker domain if available
    // R2_PUBLIC_URL should be "https://cdn.yourdomain.com"
    let url: string;
    if (R2_PUBLIC_URL) {
        url = `${R2_PUBLIC_URL}/${key}`;
    } else {
        // No public URL - generate presigned URL for 7 days
        const getCommand = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
        });
        url = await getSignedUrl(client, getCommand, { expiresIn: 604800 }); // 7 days
    }

    return { url, key };
}

/**
 * Get presigned URL for direct upload from client
 * (Better performance for large files, bypasses server)
 */
export async function getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 300 // 5 minutes
): Promise<{ url: string; publicUrl: string; key: string }> {
    const client = getR2Client();

    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        // ACL: 'private', // Not supported by R2, access controlled by bucket settings
    });

    const url = await getSignedUrl(client, command, { expiresIn });

    const publicUrl = R2_PUBLIC_URL
        ? `${R2_PUBLIC_URL}/${key}`
        : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

    return { url, publicUrl, key };
}

/**
 * Get signed URL for private file access
 * Use this when bucket is private and file is not served via Worker
 */
export async function getR2SignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const client = getR2Client();

    const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
    });

    return getSignedUrl(client, command, { expiresIn });
}

/**
 * Download file from R2
 */
export async function downloadFromR2(key: string): Promise<Buffer> {
    const client = getR2Client();

    const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
        throw new Error('No body in response');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

/**
 * Stream file from R2 (for proxying)
 */
export async function streamFromR2(key: string) {
    const client = getR2Client();

    const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
    });

    return await client.send(command);
}

/**
 * Delete file from R2
 */
export async function deleteFromR2(key: string): Promise<void> {
    const client = getR2Client();

    const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
    });

    await client.send(command);
}

/**
 * Check if file exists in R2
 */
export async function existsInR2(key: string): Promise<boolean> {
    try {
        const client = getR2Client();

        const command = new HeadObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
        });

        await client.send(command);
        return true;
    } catch {
        return false;
    }
}

/**
 * Extract R2 key from URL
 */
export function extractR2KeyFromUrl(url: string): string | null {
    try {
        const urlObj = new URL(url);
        return urlObj.pathname.slice(1); // Remove leading slash
    } catch {
        return null;
    }
}

/**
 * Check if URL is from R2
 */
export function isR2Url(url: string): boolean {
    if (!url) return false;
    const r2Indicators = ['r2.dev', 'r2.cloudflarestorage.com'];
    if (R2_PUBLIC_URL) {
        // Handle worker domain
        try {
            const workerHost = new URL(R2_PUBLIC_URL).host;
            r2Indicators.push(workerHost);
        } catch {
            // Invalid R2_PUBLIC_URL format - ignore
        }
    }
    return r2Indicators.some(indicator => url.includes(indicator));
}
