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
import { generateProductKey } from '@/lib/storage/unified-keys';
import { buildOrderStorageKey, type OrderFileCategory, getTodayDate } from '@/lib/storage/order-storage';
import { generateCustomFileName, generatePrintingFileName, generateReviewFileName } from '@/lib/fileNaming';
import { validateUploadedFile, sanitizeFilename } from '@/lib/security/file-validation';
import { trackFileUpload } from '@/lib/security/file-access';
import { BadRequestError, ForbiddenError } from '@/lib/core/BaseController';
import { UploadRequestInput } from '@/validators/upload.schema';
import { debugLog } from '@/lib/utils/debugLog';

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
        if ((params.type === 'product' || params.type === 'product-size') && !isAdmin) {
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

        // return this.uploadToR2Storage(buffer, file, params, userId);
        debugLog('[UploadService] Starting upload:', { type: params.type, filename: file.name, size: file.size });
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
        // uploadWithNaming accepts: product, printing, custom_main, custom_accessory, custom_preview
        const driveTypeMap: Record<string, 'product' | 'printing' | 'custom_main' | 'custom_accessory' | 'custom_preview'> = {
            'product': 'product',
            'product-size': 'product',
            'printing': 'printing',
            'custom': 'custom_main',
            'custom_single': 'custom_main',
            'custom_couple': 'custom_main',
            'custom_group': 'custom_main',
            'custom_preview': 'custom_preview',
        };
        const driveType = driveTypeMap[params.type] || 'custom_main';

        const options = {
            type: driveType,
            index: params.index ?? 1,
            sku: params.sku ?? undefined,
            customerCode: params.customerCode ?? undefined,
            orderCode: params.orderCode ?? undefined,
            tech: params.tech ?? undefined,
            customType: params.customType ?? undefined,
            personCount: params.personCount ?? undefined,
            photoCategory: params.photoCategory ?? undefined,
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

            const isProduct = params.type === 'product' || params.type === 'product-size';
            const identifier = isProduct ? params.sku : params.orderCode;
            if (!identifier) {
                throw new BadRequestError(
                    isProduct
                        ? 'SKU is required for product uploads'
                        : 'Order code is required for order uploads'
                );
            }
            const customerCode = params.customerCode;
            if (!isProduct && !customerCode) {
                throw new BadRequestError('Customer code is required for order uploads');
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
            if (isProduct && params.sku) {
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
                {
                    orderId: undefined,
                    orderCode: params.orderCode || undefined,
                    isPublic: params.type === 'product',
                    fileName: file.name,
                    fileType: file.type,
                    storageProvider: 'r2',
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

            // For product uploads, don't fallback to Drive - show clear error
            if (params.type === 'product' || params.type === 'product-size') {
                throw new BadRequestError(
                    'R2 Storage không khả dụng. Vui lòng kiểm tra cấu hình Cloudflare R2 (bucket name, account ID, credentials).'
                );
            }

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

        // 1b. Product Size Variant Uploads
        if (type === 'product-size' && sku) {
            return generateProductKey({
                sku: sku,
                index: index,
                ext: ext,
                variant: 'size'
            });
        }

        // 2. Order Uploads (Customer -> Date -> Order -> Type)
        const safeCustomer = customerCode || 'GUEST';
        const safeOrder = orderCode || identifier;

        let category: OrderFileCategory = 'custom_main';

        if (type === 'printing') {
            category = params.tech === 'resin' ? 'printing_resin' : 'printing_fdm';
        } else if (type === 'custom_preview') {
            category = 'custom_preview';
        } else if (type.startsWith('custom_')) {
            category = params.photoCategory === 'accessory' ? 'custom_accessory' : 'custom_main';
        }

        if (isReview) {
            category = 'review';
        }

        let fileName = filename;
        if (category.startsWith('custom_')) {
            fileName = generateCustomFileName({
                orderCode: safeOrder,
                customType: params.customType || 'single',
                personCount: params.personCount || (params.customType === 'couple' ? 2 : 1),
                photoCategory: params.photoCategory || 'main',
                photoIndex: index || 1,
                extension: ext,
            });
        } else if (category.startsWith('printing_')) {
            fileName = generatePrintingFileName({
                orderCode: safeOrder,
                tech: params.tech || 'fdm',
                fileIndex: index || 1,
                infill: params.infill || 20,
                layerHeight: params.layerHeight || '0.2',
                color: params.color || 'white',
                extension: ext,
            });
        } else if (category === 'review') {
            fileName = generateReviewFileName({
                orderCode: safeOrder,
                index: index || 1,
                extension: ext,
            });
        }

        return buildOrderStorageKey({
            customerCode: safeCustomer,
            orderCode: safeOrder,
            category,
            fileName,
            date: getTodayDate(),
        });
    }
}
