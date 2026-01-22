import { NextRequest, NextResponse } from 'next/server';
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
    getStorageDestination,
    type UploadType,
} from '@/lib/storage/r2';

/**
 * POST /api/upload
 * Upload file to R2 (images) or Google Drive (3D models)
 * 
 * Storage Flow:
 * - Product images → R2 (permanent)
 * - Customer/admin images → R2 (migrate to Drive on order complete)
 * - STL/OBJ files → Google Drive directly
 * 
 * FormData:
 *   - file: File (required)
 *   - type: 'product' | 'printing' | 'custom_main' | 'custom_accessory' | 'custom_preview'
 *   - index: number (file index)
 *   - sku: string (for products)
 *   - customerCode: string (for orders)
 *   - orderCode: string (for orders)
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const type = formData.get('type') as UploadType;
        const index = parseInt(formData.get('index') as string) || 1;
        const sku = formData.get('sku') as string;
        const customerCode = formData.get('customerCode') as string;
        const orderCode = formData.get('orderCode') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!type) {
            return NextResponse.json({ error: 'Upload type is required' }, { status: 400 });
        }

        // Validate file type
        const isImage = file.type.startsWith('image/');
        const isSTL = file.name.endsWith('.stl') || file.name.endsWith('.obj');

        if (!isImage && !isSTL) {
            return NextResponse.json({
                error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF, STL, OBJ'
            }, { status: 400 });
        }

        // Validate file size (max 100MB)
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json({
                error: 'File too large. Maximum: 100MB'
            }, { status: 400 });
        }

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Determine storage destination
        const destination = getStorageDestination(file.name, type);

        // ============================================
        // ROUTE: STL/OBJ → Google Drive
        // ============================================
        if (destination === 'drive') {
            const connected = await isDriveConnected();
            if (!connected) {
                return NextResponse.json({
                    error: 'Google Drive chưa được kết nối. Vui lòng vào Admin Settings để kết nối.'
                }, { status: 400 });
            }

            const options = {
                type,
                index,
                sku,
                customerCode,
                orderCode,
            };

            const result = await uploadWithNaming(
                buffer,
                file.name,
                file.type || 'application/octet-stream',
                options
            );

            return NextResponse.json({
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
            });
        }

        // ============================================
        // ROUTE: Images → R2
        // ============================================
        if (!isR2Configured()) {
            // Fallback to Drive if R2 not configured
            console.warn('[Upload] R2 not configured, falling back to Drive');

            const connected = await isDriveConnected();
            if (!connected) {
                return NextResponse.json({
                    error: 'Storage not configured. Please configure R2 or Google Drive.'
                }, { status: 500 });
            }

            const options = { type, index, sku, customerCode, orderCode };
            const result = await uploadWithNaming(
                buffer, file.name, file.type || 'image/jpeg', options
            );

            return NextResponse.json({
                success: true,
                storage: 'drive',
                file: {
                    id: result.fileId,
                    name: result.fileName,
                    url: getDirectUrl(result.fileId),
                    thumbnail: getThumbnailUrl(result.fileId, 400),
                },
            });
        }

        // Upload to R2
        const identifier = type === 'product' ? sku : orderCode;
        if (!identifier) {
            return NextResponse.json({
                error: type === 'product'
                    ? 'SKU is required for product uploads'
                    : 'Order code is required for order uploads'
            }, { status: 400 });
        }

        const key = generateR2Key(type, identifier, file.name, index);
        const { url } = await uploadToR2(buffer, key, file.type, {
            'upload-type': type,
            'original-name': file.name,
            ...(type === 'product' ? { sku } : { orderCode, customerCode }),
        });

        return NextResponse.json({
            success: true,
            storage: 'r2',
            file: {
                key,
                name: file.name,
                url,
                // R2 images can be used directly, no thumbnail needed
                thumbnail: url,
            },
        });
    } catch (error) {
        console.error('Upload error:', error);

        const errorMessage = (error as Error).message;

        if (errorMessage.includes('not connected')) {
            return NextResponse.json({
                error: 'Google Drive chưa được kết nối.'
            }, { status: 400 });
        }

        if (errorMessage.includes('R2 not configured')) {
            return NextResponse.json({
                error: 'R2 Storage chưa được cấu hình. Vui lòng thêm env vars.'
            }, { status: 500 });
        }

        return NextResponse.json({
            error: 'Upload failed: ' + errorMessage
        }, { status: 500 });
    }
}
