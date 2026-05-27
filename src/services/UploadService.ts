/**
* Upload Service
*
* Business logic layer for file uploads.
* Handles routing to Cloudflare R2.
*/

import {
    isR2Configured,
    uploadToR2,
} from '@/lib/storage/r2';
import {
    generateUnifiedKey,
    generateProductKey,
    generateOrderCentricKey,
    generateOrderItemKey,
    type FileType,
    type OrderFileCategory
} from '@/lib/storage/unified-keys';
import { validateUploadedFile, sanitizeFilename, RAW_IMAGE_EXTENSIONS } from '@/lib/security/file-validation';
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
    fileId?: string; // ID from files table
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

/**
 * Insert file record into `files` table and optionally link via `file_links`.
 * Replaces the old `insertOrderFile` which referenced a non-existent table.
 */
async function insertFileRecord(data: {
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
    try {
        const supabase = getAdminSupabase();

        // Determine file_url based on storage provider
        const fileUrl = data.storageProvider === 'drive' && data.driveUrl
            ? data.driveUrl
            : data.fileKey
                ? `/api/files/${data.fileKey}`
                : null;

        let fileId: string;

        // Check for existing file with same URL to prevent duplicates
        if (fileUrl) {
            const { data: existing } = await supabase
                .from('files')
                .select('id')
                .eq('file_url', fileUrl)
                .limit(1);

            if (existing && existing.length > 0) {
                console.log('[UploadService] File already exists, reusing:', existing[0].id);
                fileId = existing[0].id;
            } else {
                // Insert new file record
                const { data: inserted, error } = await supabase
                    .from('files')
                    .insert({
                        file_url: fileUrl,
                        file_key: data.fileKey,
                        object_key: data.fileKey,
                        storage_provider: data.storageProvider,
                        mime_type: data.mimeType,
                        size_bytes: data.sizeBytes,
                        provider: data.storageProvider,
                        original_filename: data.fileName,
                        file_name: data.fileName,
                        category: data.category,
                        owner_id: data.ownerId,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .select('id')
                    .single();

                if (error || !inserted) {
                    console.error('[UploadService] Failed to insert into files:', error);
                    return null;
                }
                fileId = inserted.id;
            }
        } else {
            // No file_url — insert without dedup check
            const { data: inserted, error } = await supabase
                .from('files')
                .insert({
                    file_url: fileUrl,
                    file_key: data.fileKey,
                    object_key: data.fileKey,
                    storage_provider: data.storageProvider,
                    mime_type: data.mimeType,
                    size_bytes: data.sizeBytes,
                    provider: data.storageProvider,
                    original_filename: data.fileName,
                    file_name: data.fileName,
                    category: data.category,
                    owner_id: data.ownerId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select('id')
                .single();

            if (error || !inserted) {
                console.error('[UploadService] Failed to insert into files:', error);
                return null;
            }
            fileId = inserted.id;
        }

        // 2. Resolve order_id if not provided
        let resolvedOrderId = data.orderId;
        if (!resolvedOrderId && data.orderCode) {
            const { data: order } = await supabase
                .from('orders')
                .select('id')
                .eq('order_code', data.orderCode)
                .single();
            resolvedOrderId = order?.id;
        }

        // 3. Create file_link if we have an order to link to
        if (resolvedOrderId) {
            const { error: linkError } = await supabase
                .from('file_links')
                .insert({
                    file_id: fileId,
                    ref_type: 'order',
                    ref_id: resolvedOrderId,
                    tag: data.category,
                });

            if (linkError) {
                console.error('[UploadService] Failed to insert file_link:', linkError);
                // Non-fatal: file record exists, link can be created later
            }
        }

        return fileId;
    } catch (err) {
        console.error('[UploadService] Error inserting file record:', err);
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
        const ext = lowerName.split('.').pop() || '';
        const is3DModel = lowerName.endsWith('.stl') || lowerName.endsWith('.obj') || lowerName.endsWith('.3mf') || lowerName.endsWith('.step') || lowerName.endsWith('.stp');
        // RAW images may report as application/octet-stream from the browser
        const isRawImage = RAW_IMAGE_EXTENSIONS.has(ext);

        if (!isImage && !is3DModel && !isRawImage) {
            throw new BadRequestError('Invalid file type. Allowed: JPEG, PNG, WebP, GIF, HEIC, HEIF, AVIF, TIFF, BMP, RAW (CR2, NEF, ARW, DNG, RW2, ORF, RAF), STL, OBJ, 3MF, STEP');
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

        // Validate image magic bytes (including RAW)
        if (isImage || isRawImage) {
            const validation = validateUploadedFile(file, buffer, ['image']);
            if (!validation.valid) {
                throw new BadRequestError(validation.error || 'Invalid image file');
            }
        }

        // Store every accepted upload in Cloudflare R2.
        try {
            console.log('[UploadService] Routing upload to R2:', { type: params.type, filename: file.name, size: file.size, is3DModel });
            return await this.uploadToR2Storage(buffer, file, params, userId);
        } catch (error) {
            console.error('[UploadService] R2 upload failed:', error);
            throw error;
        }
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

            // Insert into files + file_links for unified tracking
            const category = determineCategory(params, file.name);
            const fileId = await insertFileRecord({
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
                    fileId: fileId || undefined,
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

            throw error;
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
        const { type, index, isReview, orderCode, customerCode, sku, cartCode, fullCode } = params;

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

        // 2. NEW: Order Item Uploads (with fullCode)
        // Uses new path format: orders/{cartCode}/{fullCode}/{category}/{filename}
        if (cartCode && fullCode) {
            const category = determineCategory(params, filename);
            return generateOrderItemKey({
                cartCode: cartCode,
                fullCode: fullCode,
                fileName: filename,
                category: category
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
            if (params.photoCategory === 'model_image') fileType = 'model';
            else if (params.photoCategory === 'glasses') fileType = 'glasses';
            else if (params.photoCategory === 'hat') fileType = 'hat';
            else if (params.photoCategory === 'accessory') fileType = 'acc';
            else fileType = 'main';
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
