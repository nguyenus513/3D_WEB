/**
 * Storage Lifecycle Management
 *
 * Handles file promotion from temp storage to order-centric paths.
 *
 * Flow:
 * 1. Pre-checkout: Files saved to temp/{sessionId}/
 * 2. On checkout: Move files to orders/{orderCode}/
 * 3. R2 Lifecycle: Auto-delete temp/ after 24h (external config)
 */

import { S3Client, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// =============================================================================
// Types
// =============================================================================

export interface PromotionResult {
    success: boolean;
    movedFiles: string[];
    errors: string[];
}

// =============================================================================
// R2 Client (reuse from r2.ts if needed)
// =============================================================================

function getR2Client(): S3Client {
    return new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT!,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
    });
}

const BUCKET = process.env.R2_BUCKET_NAME!;

// =============================================================================
// File Promotion
// =============================================================================

/**
 * Promote files from temp storage to order-centric path
 *
 * Moves all files from temp/{sessionId}/ to orders/{orderCode}/
 *
 * @example
 * await promoteToOrder('sess_abc123', '4A1B9C2D8E3F');
 * // Moves: temp/sess_abc123/model.stl -> orders/4A1B9C2D8E3F/model.stl
 */
export async function promoteToOrder(
    sessionId: string,
    orderCode: string
): Promise<PromotionResult> {
    const client = getR2Client();
    const movedFiles: string[] = [];
    const errors: string[] = [];

    // Sanitize inputs
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const safeOrderCode = orderCode.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();

    if (!safeSessionId || safeOrderCode.length < 8) {
        return {
            success: false,
            movedFiles: [],
            errors: ['Invalid session ID or order code'],
        };
    }

    const sourcePrefix = `temp/${safeSessionId}/`;
    const destPrefix = `orders/${safeOrderCode}/`;

    try {
        // List all files in temp folder
        const listCommand = new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: sourcePrefix,
        });

        const listResult = await client.send(listCommand);
        const files = listResult.Contents || [];

        if (files.length === 0) {
            console.log(`[StorageLifecycle] No files found in ${sourcePrefix}`);
            return { success: true, movedFiles: [], errors: [] };
        }

        // Move each file
        for (const file of files) {
            if (!file.Key) continue;

            const fileName = file.Key.replace(sourcePrefix, '');
            const destKey = `${destPrefix}${fileName}`;

            try {
                // Copy to new location
                await client.send(new CopyObjectCommand({
                    Bucket: BUCKET,
                    CopySource: `${BUCKET}/${file.Key}`,
                    Key: destKey,
                }));

                // Delete from old location
                await client.send(new DeleteObjectCommand({
                    Bucket: BUCKET,
                    Key: file.Key,
                }));

                movedFiles.push(fileName);
                console.log(`[StorageLifecycle] Moved: ${file.Key} -> ${destKey}`);
            } catch (fileError) {
                const errMsg = `Failed to move ${file.Key}: ${fileError}`;
                console.error(`[StorageLifecycle] ${errMsg}`);
                errors.push(errMsg);
            }
        }

        return {
            success: errors.length === 0,
            movedFiles,
            errors,
        };
    } catch (error) {
        console.error('[StorageLifecycle] Promotion failed:', error);
        return {
            success: false,
            movedFiles,
            errors: [`List operation failed: ${error}`],
        };
    }
}

/**
 * Check if temp folder has files for a session
 */
export async function hasTempFiles(sessionId: string): Promise<boolean> {
    const client = getR2Client();
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

    try {
        const result = await client.send(new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: `temp/${safeSessionId}/`,
            MaxKeys: 1,
        }));

        return (result.Contents?.length || 0) > 0;
    } catch {
        return false;
    }
}

/**
 * Delete all files in temp folder for a session
 * (Used for cleanup on session abandonment)
 */
export async function cleanupTempFiles(sessionId: string): Promise<void> {
    const client = getR2Client();
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const prefix = `temp/${safeSessionId}/`;

    try {
        const listResult = await client.send(new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: prefix,
        }));

        for (const file of listResult.Contents || []) {
            if (file.Key) {
                await client.send(new DeleteObjectCommand({
                    Bucket: BUCKET,
                    Key: file.Key,
                }));
            }
        }

        console.log(`[StorageLifecycle] Cleaned up temp files for session: ${safeSessionId}`);
    } catch (error) {
        console.error(`[StorageLifecycle] Cleanup failed for ${safeSessionId}:`, error);
    }
}
