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
    generateOrderCentricKey,
    type FileType,
    type OrderFileCategory
} from '@/lib/storage/unified-keys';
import { validateUploadedFile, sanitizeFilename } from '@/lib/security/file-validation';
import { trackFileUpload } from '@/lib/security/file-access';
import { BadRequestError, ForbiddenError } from '@/lib/core/BaseController';
import { UploadRequestInput } from '@/validators/upload.schema';
import { getAdminSupabase } from '@/lib/supabase/admin';

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
    orderFileId?: string; // ID from order_files table
}

interface UploadResult {
    success: boolean;
    storage: 'r2' | 'drive';
    file: UploadedFile;
}

// Determine file category based on upload type and file extension
function determineCategory(params: UploadRequestInput, fileName: string): OrderFileCategory {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const is3DModel = ['stl', 'obj', '3mf', 'step', 'stp'].includes(ext);

    if (is3DModel) return 'models';
    if (params.isReview) return 'review';
    if (params.type.startsWith('custom_')) return 'images';
    if (params.type === 'printing') return 'images';

    return 'images'; // default
}

// Insert record into order_files table for tracking
async function insertOrderFile(data: {
    orderCode?: string;
    orderId?: string;
    fileKey?: string;
    storageProvider: 'r2' | 'drive';
    driveFileId?: string;
    driveUrl?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    category: OrderFileCategory;
    ownerId: string;
}): Promise<string | null> {
    // Skip if no order code (e.g., product uploads)
    if (!data.orderCode) return null;

    try {
        const supabase = getAdminSupabase();

        // First try to get order_id from order_code
        let resolvedOrderId = data.orderId;
        if (!resolvedOrderId && data.orderCode) {
            const { data: order } = await supabase
                .from('orders')
                .select('id')
                .eq('order_code', data.orderCode)
                .single();
            resolvedOrderId = order?.id;
        }

        const { data: inserted, error } = await supabase
            .from('order_files')
            .insert({
                order_id: resolvedOrderId || null,
                order_code: data.orderCode,
                file_key: data.fileKey || null,
                storage_provider: data.storageProvider,
                drive_file_id: data.driveFileId || null,
                drive_url: data.driveUrl || null,
                file_name: data.fileName,
                mime_type: data.mimeType,
                size_bytes: data.sizeBytes,
                category: data.category,
                owner_id: data.ownerId,
            })
            .select('id')
            .single();

        if (error) {
            console.error('[UploadService] Failed to insert order_files:', error);
            return null;
        }

        return inserted?.id || null;
    } catch (err) {
        console.error('[UploadService] Error inserting order_files:', err);
        return null;
    }
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
        const lowerName = file.name.toLowerCase();
        const is3DModel = lowerName.endsWith('.stl') || lowerName.endsWith('.obj') || lowerName.endsWith('.3mf') || lowerName.endsWith('.step') || lowerName.endsWith('.stp');

        if (!isImage && !is3DModel) {
            throw new BadRequestError('Invalid file type. Allowed: JPEG, PNG, WebP, GIF, STL, OBJ, 3MF, STEP');
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
        // STRATEGY:
        // - Images -> R2 (Hot Storage) for fast CDN delivery
        // - 3D Models -> Google Drive (Production Storage) for manufacturing/archival

        try {
            console.log('[UploadService] Starting upload:', { type: params.type, filename: file.name, size: file.size });

            if (is3DModel) {
                console.log('[UploadService] Routing 3D model to Google Drive...');
                return await this.uploadToDrive(buffer, file, params);
            } else {
                console.log('[UploadService] Routing image to R2...');
                return await this.uploadToR2Storage(buffer, file, params, userId);
            }
        } catch (error) {
            console.error('[UploadService] Upload failed:', error);

            // Fallback strategy
            if (is3DModel) {
                // If Drive fails for 3D model, try R2 as backup? 
                // Or typically we might just fail since Drive is required for production.
                // But let's try R2 as backup if Drive fails, just to save the file.
                console.warn('[UploadService] Google Drive upload failed. Retrying with R2 backup...');
                try {
                    return await this.uploadToR2Storage(buffer, file, params, userId);
                } catch (r2Error) {
                    throw error; // Throw original error if both fail
                }
            } else {
                // If R2 fails for image, try Drive as backup
                console.warn('[UploadService] R2 upload failed. Retrying with Google Drive backup...');
                return await this.uploadToDrive(buffer, file, params);
            }
        }
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
            'product-size': 'product',
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

        // Insert into order_files table for unified tracking
        const category = determineCategory(params, file.name);
        const orderFileId = await insertOrderFile({
            orderCode: params.orderCode || undefined,
            driveFileId: result.fileId,
            driveUrl: getDirectUrl(result.fileId),
            storageProvider: 'drive',
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: buffer.length,
            category,
            ownerId: params.customerCode || 'SYSTEM',
        });

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
                orderFileId: orderFileId || undefined,
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

            const identifier = (params.type === 'product' || params.type === 'product-size') ? params.sku : params.orderCode;
            if (!identifier) {
                throw new BadRequestError(
                    (params.type === 'product' || params.type === 'product-size')
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
            if ((params.type === 'product' || params.type === 'product-size') && params.sku) {
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

            // Insert into order_files table for unified tracking
            const category = determineCategory(params, file.name);
            const orderFileId = await insertOrderFile({
                orderCode: params.orderCode ?? undefined,
                fileKey: key,
                storageProvider: 'r2',
                fileName: file.name,
                mimeType: file.type,
                sizeBytes: buffer.length,
                category,
                ownerId: userId,
            });

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
                    orderFileId: orderFileId || undefined,
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
