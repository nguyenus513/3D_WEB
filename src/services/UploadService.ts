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
} from '@/lib/storage/r2';
import {
    generateUnifiedKey,
    generateProductKey,
    type FileType
} from '@/lib/storage/unified-keys';
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
        try {
            if (!isR2Configured()) {
                throw new Error('R2 not configured');
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
        } catch (error) {
            console.error('[Upload] R2 Upload Failed:', error);
            console.warn('[Upload] Falling back to Google Drive...');
            return this.uploadToDrive(buffer, file, params);
        }
    }

    /**
     * Generate R2 key based on upload type and naming convention
     * Uses Unified Keys (Hex ID compatible)
     */
    private generateR2Key(
        params: UploadRequestInput,
        identifier: string,
        ext: string,
        filename: string
    ): string {
        const { type, index, isReview, orderCode, customerCode, sku } = params;

        // 1. Product Uploads
        if (type === 'product' && sku) {
            return generateProductKey({
                sku: sku,
                index: index,
                ext: ext
            });
        }

        // 2. Order Uploads
        // Note: During upload, we might not have the Master Order Code (parentOrderCode).
        // Unified Keys allow omitting parentOrderCode (defaults to childOrderCode).
        // The file will be migrated to the correct Master Order folder later by migrate-to-drive.ts.

        let fileType: FileType = 'main';

        // Map upload type to FileType
        if (type === 'printing') {
            fileType = params.tech === 'resin' ? 'resin' : 'fdm';
        } else if (type.startsWith('custom_')) {
            // Check photo category for custom orders
            fileType = params.photoCategory === 'accessory' ? 'acc' : 'main';
        }

        // Override if review flag is set
        if (isReview) {
            fileType = 'review';
        }

        // Construct unified key params
        // Use orderCode (Child Code) as identifier
        return generateUnifiedKey({
            customerCode: customerCode || 'GUEST',
            // timestamp automatically generated
            // parentOrderCode omitted -> will use childOrderCode as parent folder temporarily
            childOrderCode: orderCode || identifier,
            fileType: fileType,
            index: index,
            ext: ext
        });
    }
}
