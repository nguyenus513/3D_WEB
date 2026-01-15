import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, generateFileName, isValidImageType, isValidSTLType, type FolderType } from '@/lib/google-drive';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const folderType = (formData.get('folderType') as FolderType) || 'products';
        const prefix = (formData.get('prefix') as string) || '';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const isImage = isValidImageType(file.type);
        const isSTL = isValidSTLType(file.type) || file.name.endsWith('.stl');

        if (!isImage && !isSTL) {
            return NextResponse.json({
                error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF, STL'
            }, { status: 400 });
        }

        // Validate file size (max 50MB)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json({
                error: 'File too large. Maximum size is 50MB'
            }, { status: 400 });
        }

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Generate unique filename
        const fileName = generateFileName(file.name, prefix);

        // Upload to Google Drive
        const result = await uploadFile(buffer, fileName, file.type, folderType);

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

        // Check if it's a configuration error
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
