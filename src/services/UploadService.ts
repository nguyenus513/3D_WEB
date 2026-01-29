/**
 * Upload Service
 *
 * Business logic layer for file uploads.
 * Handles routing to R2 or Google Drive based on file type.
 */

import {
    uploadWithNaming,
    isDriveConnected,
    getDirectUrl,
    getThumbnailUrl,
} from '@/lib/google-drive-oauth';
import {
    isR2Configured,
    uploadToR2,
    generateR2Key,
    generateCustomR2Key,
    generatePrintingR2Key,
    generateReviewR2Key,
    getStorageDestination,
    type UploadType,
} from '@/lib/storage/r2';
import { validateUploadedFile, sanitizeFilename } from '@/lib/security/file-validation';
import { trackFileUpload } from '@/lib/security/file-access';
import { BadRequestError, ForbiddenError } from '@/lib/core/BaseController';
import { UploadRequestInput } from '@/validators/upload.schema';

// =============================================================================
// Types
// =============================================================================

interface UploadedFile {
    key?: string;
    id?: string;
    name: string;
    url: string;
    thumbnail: string;
    viewUrl?: string;
    downloadUrl?: string;
}

interface UploadResult {
    success: boolean;
    storage: 'r2' | 'drive';
    file: UploadedFile;
}

// =============================================================================
// Upload Service
// =============================================================================

export class UploadService {
    /**
     * Upload a file to appropriate storage
     */
    async uploadFile(
        file: File,
        buffer: Buffer,
        params: UploadRequestInput,
        userId: string,
        isAdmin: boolean
    ): Promise<UploadResult> {
        // Validate file type
        const isImage = file.type.startsWith('image/');
        const isSTL = file.name.endsWith('.stl') || file.name.endsWith('.obj');

        if (!isImage && !isSTL) {
            throw new BadRequestError('Invalid file type. Allowed: JPEG, PNG, WebP, GIF, STL, OBJ');
        }

        // Validate file size (max 100MB)
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new BadRequestError('File too large. Maximum: 100MB');
        }

        // Product uploads require admin
        if (params.type === 'product' && !isAdmin) {
            throw new ForbiddenError('Admin only');
        }

        // Order uploads require order code (for non-admin)
        if (!isAdmin && (params.type === 'printing' || params.type.startsWith('custom_'))) {
            if (!params.orderCode) {
                throw new BadRequestError('Order code required');
            }
        }

        // Sanitize filename
        const safeFilename = sanitizeFilename(file.name);

        // Validate image magic bytes
        if (isImage) {
            const validation = validateUploadedFile(file, buffer, ['image']);
            if (!validation.valid) {
                throw new BadRequestError(validation.error || 'Invalid image file');
            }
        }

        // Determine storage destination
        // Determine storage destination
        // HYBRID STORAGE STRATEGY (Hot vs Cold):
        // All new uploads go to R2 (Hot Storage) for reliability and speed.
        // Google Drive is used ONLY for archival (Cold Storage) via separate process.
        // This prevents checkout failures due to Drive token expiration.

        return this.uploadToR2Storage(buffer, file, params, userId);
    }

    /**
     * Upload to Google Drive (STL/OBJ files)
     */
    private async uploadToDrive(
        buffer: Buffer,
        file: File,
        params: UploadRequestInput
    ): Promise<UploadResult> {
        const connected = await isDriveConnected();
        if (!connected) {
            throw new BadRequestError('Google Drive chưa được kết nối. Vui lòng vào Admin Settings để kết nối.');
        }

        // Map upload types to Drive folder types
        // uploadWithNaming only accepts: product, printing, custom_main, custom_accessory, custom_preview
        const driveTypeMap: Record<string, 'product' | 'printing' | 'custom_main' | 'custom_accessory' | 'custom_preview'> = {
            'product': 'product',
            'printing': 'printing',
            'custom': 'custom_main',
            'custom_single': 'custom_main',
            'custom_couple': 'custom_main',
            'custom_group': 'custom_main',
        };
        const driveType = driveTypeMap[params.type] || 'custom_main';

        const options = {
            type: driveType,
            index: params.index ?? 1,
            sku: params.sku ?? undefined,
            customerCode: params.customerCode ?? undefined,
            orderCode: params.orderCode ?? undefined,
        };

        const result = await uploadWithNaming(
            buffer,
            file.name,
            file.type || 'application/octet-stream',
            options
        );

        return {
            success: true,
            storage: 'drive',
            file: {
                id: result.fileId,
                name: result.fileName,
                url: getDirectUrl(result.fileId),
                thumbnail: getThumbnailUrl(result.fileId, 400),
                viewUrl: result.webViewLink,
                downloadUrl: result.webContentLink,
            },
        };
    }

    /**
     * Upload to R2 (Images)
     */
    private async uploadToR2Storage(
        buffer: Buffer,
        file: File,
        params: UploadRequestInput,
        userId: string
    ): Promise<UploadResult> {
        if (!isR2Configured()) {
            // Log detailed error for debugging
            console.error('[Upload] R2 not configured! Missing env vars: CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
            console.warn('[Upload] Falling back to Google Drive...');
            return this.uploadToDrive(buffer, file, params);
        }

        const identifier = params.type === 'product' ? params.sku : params.orderCode;
        if (!identifier) {
            throw new BadRequestError(
                params.type === 'product'
                    ? 'SKU is required for product uploads'
                    : 'Order code is required for order uploads'
            );
        }

        // Get file extension
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';

        // Generate key based on upload type
        const key = this.generateR2Key(params, identifier, ext, file.name);

        // Build metadata object
        const metadata: Record<string, string> = {
            'upload-type': params.type,
            'original-name': file.name,
        };
        if (params.type === 'product' && params.sku) {
            metadata.sku = params.sku;
        } else {
            if (params.orderCode) metadata.orderCode = params.orderCode;
            if (params.customerCode) metadata.customerCode = params.customerCode;
        }

        // Upload to R2
        await uploadToR2(buffer, key, file.type, metadata);

        // Track file ownership
        await trackFileUpload(
            key,
            userId,
            params.orderCode || undefined,
            {
                isPublic: params.type === 'product',
                fileName: file.name,
                fileType: file.type,
            }
        );

        // Return secure proxy URL
        const secureUrl = `/api/files/${key}`;

        return {
            success: true,
            storage: 'r2',
            file: {
                key, // R2 key
                id: key, // Map key to id for compatibility
                name: file.name,
                url: secureUrl,
                thumbnail: secureUrl,
                viewUrl: secureUrl, // Map to viewUrl for compatibility
                downloadUrl: secureUrl,
            },
        };
    }

    /**
     * Generate R2 key based on upload type and naming convention
     */
    private generateR2Key(
        params: UploadRequestInput,
        identifier: string,
        ext: string,
        filename: string
    ): string {
        const { type, index, isReview, tech, customType, personCount, photoCategory, infill, layerHeight, color, orderCode } = params;

        if (type === 'product') {
            return generateR2Key(type as UploadType, identifier, filename, index);
        }

        if (isReview && orderCode) {
            return generateReviewR2Key(orderCode, index, ext);
        }

        if (type === 'printing' && tech && orderCode) {
            return generatePrintingR2Key(orderCode, tech, index, infill ?? undefined, layerHeight ?? undefined, color ?? undefined, ext);
        }

        if (type.startsWith('custom_') && customType && orderCode) {
            return generateCustomR2Key(orderCode, customType, personCount || 1, photoCategory || 'main', index, ext);
        }

        // Fallback to legacy naming
        return generateR2Key(type as UploadType, identifier, filename, index);
    }
}
