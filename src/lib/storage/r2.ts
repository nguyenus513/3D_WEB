/**
 * Cloudflare R2 Storage Service
 * 
 * Hybrid Storage Flow:
 * - Product images: R2 (permanent, fast serving)
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
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '3d-print-uploads';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Check if R2 is configured
export function isR2Configured(): boolean {
    return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

// Create S3 client for R2
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
 * - product: Product images (permanent on R2)
 * - printing: 3D printing order files
 * - custom_main/custom_accessory/custom_preview: Custom order files
 */
export type UploadType = 'product' | 'printing' | 'custom_main' | 'custom_accessory' | 'custom_preview';

/**
 * Check if upload type should stay permanent on R2 (no migration)
 */
export function isPermanentOnR2(uploadType: UploadType): boolean {
    return uploadType === 'product';
}

/**
 * Determine storage destination based on file type
 */
export function getStorageDestination(filename: string, uploadType: UploadType): 'r2' | 'drive' {
    const ext = filename.toLowerCase().split('.').pop() || '';

    // 3D models always go to Drive
    if (['stl', 'obj', '3mf'].includes(ext)) {
        return 'drive';
    }

    // All images go to R2
    return 'r2';
}

/**
 * Generate R2 key with proper folder structure
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
 * Upload file to R2
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
        Metadata: metadata,
    });

    await client.send(command);

    // Return public URL
    const url = R2_PUBLIC_URL
        ? `${R2_PUBLIC_URL}/${key}`
        : `https://pub-${R2_ACCOUNT_ID}.r2.dev/${key}`;

    return { url, key };
}

/**
 * Get signed URL for private file access
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
    if (R2_PUBLIC_URL) r2Indicators.push(R2_PUBLIC_URL);
    return r2Indicators.some(indicator => url.includes(indicator));
}
