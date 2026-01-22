import { NextRequest, NextResponse } from 'next/server';
import {
    uploadWithNaming,
    isDriveConnected,
    getDirectUrl,
    getThumbnailUrl,
} from '@/lib/google-drive-oauth';

/**
 * POST /api/upload
 * Upload file to Google Drive with automatic naming and folder organization
 * 
 * FormData:
 *   - file: File (required)
 *   - type: 'product' | 'printing' | 'custom_main' | 'custom_accessory' | 'custom_preview'
 *   - index: number (file index, e.g. 1, 2, 3)
 *   
 *   For products:
 *   - sku: string (e.g., 'FIG-001')
 *   
 *   For printing/custom:
 *   - customerCode: string (e.g., 'CUS-ABC123')
 *   - orderCode: string (e.g., 'P3D-2024-001' or 'CUS-2024-001')
 */
export async function POST(request: NextRequest) {
    try {
        // Check if Drive is connected
        const connected = await isDriveConnected();
        if (!connected) {
            return NextResponse.json({
                error: 'Google Drive chưa được kết nối. Vui lòng vào Admin Settings để kết nối.'
            }, { status: 400 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const type = formData.get('type') as 'product' | 'printing' | 'custom_main' | 'custom_accessory' | 'custom_preview';
        const index = parseInt(formData.get('index') as string) || 1;

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

        // Build upload options
        const options: Parameters<typeof uploadWithNaming>[3] = {
            type,
            index,
            sku: formData.get('sku') as string,
            customerCode: formData.get('customerCode') as string,
            orderCode: formData.get('orderCode') as string,
        };

        // Upload with automatic naming
        const result = await uploadWithNaming(
            buffer,
            file.name,
            file.type || 'application/octet-stream',
            options
        );

        // Return with proper URLs
        return NextResponse.json({
            success: true,
            file: {
                id: result.fileId,
                name: result.fileName,
                url: getDirectUrl(result.fileId),
                thumbnail: getThumbnailUrl(result.fileId, 400),
                viewUrl: result.webViewLink,
                downloadUrl: result.webContentLink,
            },
        });
    } catch (error) {
        console.error('Upload error:', error);

        const errorMessage = (error as Error).message;

        if (errorMessage.includes('not connected')) {
            return NextResponse.json({
                error: 'Google Drive chưa được kết nối. Vui lòng vào Admin Settings để kết nối.'
            }, { status: 400 });
        }

        if (errorMessage.includes('expired')) {
            return NextResponse.json({
                error: 'Token hết hạn. Vui lòng kết nối lại Google Drive trong Admin Settings.'
            }, { status: 401 });
        }

        return NextResponse.json({
            error: 'Upload failed: ' + errorMessage
        }, { status: 500 });
    }
}
