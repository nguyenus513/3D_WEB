import { NextRequest, NextResponse } from 'next/server';
import {
    uploadFile,
    generateFileName,
    isValidImageType,
    isValidSTLType,
    getOrCreatePath,
    type FolderType
} from '@/lib/google-drive';

/**
 * Upload API - Supports organized folder structure
 * 
 * POST /api/upload
 * FormData:
 *   - file: File (required)
 *   - folderType: 'products' | 'custom_orders' | 'printing_orders'
 *   - subfolders: JSON array of subfolder names, e.g. '["ORD001", "input"]'
 *   - prefix: filename prefix
 * 
 * Examples:
 *   - Product image: folderType='products', subfolders='["models"]'
 *   - Custom order input: folderType='custom_orders', subfolders='["ORD001", "input"]'
 *   - Printing STL: folderType='printing_orders', subfolders='["PRT001"]'
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const folderType = (formData.get('folderType') as FolderType) || 'products';
        const subfoldersRaw = formData.get('subfolders') as string;
        const prefix = (formData.get('prefix') as string) || '';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const isImage = isValidImageType(file.type);
        const isSTL = isValidSTLType(file.type) || file.name.endsWith('.stl') || file.name.endsWith('.obj');

        if (!isImage && !isSTL) {
            return NextResponse.json({
                error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF, STL, OBJ'
            }, { status: 400 });
        }

        // Validate file size (max 100MB for STL/OBJ)
        const maxSize = isSTL ? 100 * 1024 * 1024 : 50 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json({
                error: `File too large. Maximum: ${isSTL ? '100MB' : '50MB'}`
            }, { status: 400 });
        }

        // Parse subfolders
        let subfolders: string[] = [];
        if (subfoldersRaw) {
            try {
                subfolders = JSON.parse(subfoldersRaw);
            } catch {
                return NextResponse.json({ error: 'Invalid subfolders format' }, { status: 400 });
            }
        }

        // Get or create folder path
        let targetFolderId: string | undefined;
        if (subfolders.length > 0) {
            targetFolderId = await getOrCreatePath(folderType, subfolders);
        }

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Generate unique filename
        const fileName = generateFileName(file.name, prefix);

        // Upload to Google Drive
        const result = await uploadFile(buffer, fileName, file.type, folderType, targetFolderId);

        return NextResponse.json({
            success: true,
            file: {
                id: result.fileId,
                name: result.fileName,
                url: result.webContentLink,
                viewUrl: result.webViewLink,
                thumbnail: result.thumbnailLink,
            },
        });
    } catch (error) {
        console.error('Upload error:', error);

        if ((error as Error).message?.includes('credentials')) {
            return NextResponse.json({
                error: 'Google Drive not configured. Please set up credentials.'
            }, { status: 500 });
        }

        return NextResponse.json({
            error: 'Upload failed: ' + (error as Error).message
        }, { status: 500 });
    }
}
