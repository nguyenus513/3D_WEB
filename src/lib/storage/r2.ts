/**
 * Cloudflare R2 Storage Service
 * 
 * Phase 7: Hybrid Storage - R2 for hot storage, Google Drive for cold archive
 * 
 * Usage:
 * - Product images: R2 (stay on R2, public)
 * - Customer uploads (images): R2 → Drive after order complete
 * - STL/OBJ files: Direct to Google Drive (large files)
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
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // Custom domain or R2.dev URL

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

// File categories for storage routing
export type FileCategory = 'product_image' | 'customer_upload' | 'model_3d';

// Determine storage destination based on file category
export function getStorageDestination(category: FileCategory, fileExtension: string): 'r2' | 'drive' {
    // 3D models always go to Drive
    if (category === 'model_3d' || ['stl', 'obj', '3mf'].includes(fileExtension.toLowerCase())) {
        return 'drive';
    }

    // Images go to R2 for fast serving
    return 'r2';
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
        Metadata: metadata,
    });

    await client.send(command);

    // Return public URL
    const url = R2_PUBLIC_URL
        ? `${R2_PUBLIC_URL}/${key}`
        : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

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
 * Generate unique key for upload
 */
export function generateR2Key(
    category: FileCategory,
    orderId: string,
    filename: string
): string {
    const timestamp = Date.now();
    const safeName = filename
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, '_');

    return `${category}/${orderId}/${timestamp}_${safeName}`;
}
