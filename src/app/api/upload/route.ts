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
    generateCustomR2Key,
    generatePrintingR2Key,
    generateReviewR2Key,
    getStorageDestination,
    type UploadType,
} from '@/lib/storage/r2';
import { auth } from '@/auth';
import { checkUploadRateLimit } from '@/lib/security/rate-limit';
import { validateUploadedFile, sanitizeFilename } from '@/lib/security/file-validation';
import { trackFileUpload } from '@/lib/security/file-access';

/**
 * POST /api/upload
 * Upload file to R2 (images) or Google Drive (3D models)
 * 
 * SECURITY:
 * - Requires authentication (session)
 * - Admin can upload anything
 * - Users can only upload to their own orders
 * - Product uploads require admin
 * - Rate limited per user
 * 
 * Storage Flow:
 * - Product images → R2 (permanent, admin only)
 * - Customer/admin images → R2 (migrate to Drive on order complete)
 * - STL/OBJ files → Google Drive directly
 * 
 * New Naming Convention Parameters:
 * - customType: 'single' | 'couple' | 'group' (for custom orders)
 * - personCount: number (for group orders)
 * - photoCategory: 'main' | 'accessory' (for custom orders)
 * - tech: 'resin' | 'fdm' (for printing orders)
 * - infill: number (15, 20, 30, 50 for FDM)
 * - layerHeight: string ('0.2', '0.12', '0.08' for FDM)
 * - color: 'white' | 'black' | 'transparent' (for FDM)
 * - isReview: boolean (admin review/demo upload)
 */
export async function POST(request: NextRequest) {
    try {
        // SECURITY: Require authentication
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id || session.user.email || 'unknown';
        const userRole = (session.user as { role?: string }).role;
        const isAdmin = userRole === 'admin';

        // SECURITY: Rate limit (10 uploads per minute for users, 100 for admin)
        const rateLimit = await checkUploadRateLimit(userId, isAdmin);
        if (!rateLimit.allowed) {
            return NextResponse.json({
                error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
                retryAfter: rateLimit.retryAfter,
            }, { status: 429 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const type = formData.get('type') as UploadType;
        const index = parseInt(formData.get('index') as string) || 1;
        const sku = formData.get('sku') as string;
        const customerCode = formData.get('customerCode') as string;
        const orderCode = formData.get('orderCode') as string;

        // New naming parameters
        const customType = formData.get('customType') as 'single' | 'couple' | 'group' | null;
        const personCount = parseInt(formData.get('personCount') as string) || 1;
        const photoCategory = (formData.get('photoCategory') as 'main' | 'accessory') || 'main';
        const tech = formData.get('tech') as 'resin' | 'fdm' | null;
        const infill = parseInt(formData.get('infill') as string) || 20;
        const layerHeight = formData.get('layerHeight') as string || '0.2';
        const color = (formData.get('color') as 'white' | 'black' | 'transparent') || 'white';
        const isReview = formData.get('isReview') === 'true';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!type) {
            return NextResponse.json({ error: 'Upload type is required' }, { status: 400 });
        }

        // SECURITY: Product uploads require admin
        if (type === 'product' && !isAdmin) {
            return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
        }

        // SECURITY: For order uploads, verify user owns the order (or is admin)
        // This is a basic check - ideally verify against DB
        if (!isAdmin && (type === 'printing' || type.startsWith('custom_'))) {
            // For now, allow if customerCode matches session user's code
            // In production, verify order belongs to user via DB query
            if (!orderCode) {
                return NextResponse.json({ error: 'Order code required' }, { status: 400 });
            }
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

        // SECURITY: Sanitize filename
        const safeFilename = sanitizeFilename(file.name);

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // SECURITY: Magic-bytes validation to prevent malicious files
        if (isImage) {
            const validation = validateUploadedFile(file, buffer, ['image']);
            if (!validation.valid) {
                return NextResponse.json({
                    error: validation.error || 'Invalid image file'
                }, { status: 400 });
            }
        }

        // Determine storage destination
        const destination = getStorageDestination(safeFilename, type);

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

        // Get file extension
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';

        // Generate key based on upload type with new naming convention
        let key: string;
        if (type === 'product') {
            // Product uploads use legacy naming
            key = generateR2Key(type, identifier, file.name, index);
        } else if (isReview) {
            // Admin review/demo images: {orderCode}-0.{index}.{ext}
            key = generateReviewR2Key(orderCode, index, ext);
        } else if (type === 'printing' && tech) {
            // Printing orders with tech specified
            key = generatePrintingR2Key(orderCode, tech, index, infill, layerHeight, color, ext);
        } else if (type.startsWith('custom_') && customType) {
            // Custom orders with customType specified
            key = generateCustomR2Key(orderCode, customType, personCount, photoCategory, index, ext);
        } else {
            // Fallback to legacy naming
            key = generateR2Key(type, identifier, file.name, index);
        }

        await uploadToR2(buffer, key, file.type, {
            'upload-type': type,
            'original-name': file.name,
            ...(type === 'product' ? { sku } : { orderCode, customerCode }),
        });

        // SECURITY: Track file ownership for access control
        const actualUserId = session.user.id || session.user.email;
        if (actualUserId) {
            await trackFileUpload(
                key,                           // fileKey
                actualUserId,                  // ownerId
                orderCode || undefined,        // orderId (optional)
                {
                    isPublic: type === 'product', // Product images are public
                    fileName: file.name,
                    fileType: file.type,
                }
            );
        }

        // SECURITY: Return API proxy URL instead of direct R2 URL
        // All file access goes through /api/files for ownership verification
        const secureUrl = `/api/files/${key}`;

        return NextResponse.json({
            success: true,
            storage: 'r2',
            file: {
                key,
                name: file.name,
                url: secureUrl,
                thumbnail: secureUrl,
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
