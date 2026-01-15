/**
 * Google Drive API Integration
 * Free 15GB storage per service account
 * 
 * Setup:
 * 1. Create Google Cloud Project: https://console.cloud.google.com/
 * 2. Enable Google Drive API
 * 3. Create Service Account + download JSON key
 * 4. Share target folder with service account email
 * 5. Add env vars: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID
 */

import { google } from 'googleapis';

// Environment variables (add to .env.local)
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Initialize Google Drive API
function getDriveClient() {
    if (!SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
        throw new Error('Google Drive credentials not configured');
    }

    const auth = new google.auth.JWT({
        email: SERVICE_ACCOUNT_EMAIL,
        key: PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    return google.drive({ version: 'v3', auth });
}

// Folder IDs for different file types
export const DRIVE_FOLDERS = {
    products: process.env.GOOGLE_DRIVE_PRODUCTS_FOLDER_ID || FOLDER_ID,
    custom_orders: process.env.GOOGLE_DRIVE_CUSTOM_FOLDER_ID || FOLDER_ID,
    printing_orders: process.env.GOOGLE_DRIVE_PRINTING_FOLDER_ID || FOLDER_ID,
};

export type FolderType = keyof typeof DRIVE_FOLDERS;

interface UploadResult {
    fileId: string;
    fileName: string;
    webViewLink: string;
    webContentLink: string;
    thumbnailLink?: string;
}

/**
 * Upload file to Google Drive
 */
export async function uploadFile(
    file: Buffer,
    fileName: string,
    mimeType: string,
    folderType: FolderType = 'products'
): Promise<UploadResult> {
    const drive = getDriveClient();
    const folderId = DRIVE_FOLDERS[folderType];

    if (!folderId) {
        throw new Error(`Folder ID not configured for: ${folderType}`);
    }

    // Upload file
    const response = await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [folderId],
        },
        media: {
            mimeType,
            body: require('stream').Readable.from(file),
        },
        fields: 'id, name, webViewLink, webContentLink, thumbnailLink',
    });

    // Make file publicly accessible (read-only)
    await drive.permissions.create({
        fileId: response.data.id!,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    });

    return {
        fileId: response.data.id!,
        fileName: response.data.name!,
        webViewLink: response.data.webViewLink!,
        webContentLink: response.data.webContentLink!,
        thumbnailLink: response.data.thumbnailLink ?? undefined,
    };
}

/**
 * Get direct image URL from Google Drive
 */
export function getDirectImageUrl(fileId: string): string {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/**
 * Get thumbnail URL
 */
export function getThumbnailUrl(fileId: string, size: number = 400): string {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

/**
 * Delete file from Google Drive
 */
export async function deleteFile(fileId: string): Promise<void> {
    const drive = getDriveClient();
    await drive.files.delete({ fileId });
}

/**
 * List files in a folder
 */
export async function listFiles(folderType: FolderType = 'products') {
    const drive = getDriveClient();
    const folderId = DRIVE_FOLDERS[folderType];

    const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, size, createdTime, webViewLink, thumbnailLink)',
        orderBy: 'createdTime desc',
        pageSize: 100,
    });

    return response.data.files || [];
}

/**
 * Generate unique filename
 */
export function generateFileName(originalName: string, prefix: string = ''): string {
    const ext = originalName.split('.').pop();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}${timestamp}_${random}.${ext}`;
}

/**
 * Validate file type
 */
export function isValidImageType(mimeType: string): boolean {
    return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType);
}

export function isValidSTLType(mimeType: string): boolean {
    return ['application/sla', 'application/vnd.ms-pki.stl', 'model/stl', 'application/octet-stream'].includes(mimeType);
}

/**
 * Parse file extension for allowed types
 */
export function getAllowedMimeTypes(type: 'image' | 'stl' | 'all'): string[] {
    switch (type) {
        case 'image':
            return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        case 'stl':
            return ['application/sla', 'application/vnd.ms-pki.stl', 'model/stl', 'application/octet-stream'];
        case 'all':
            return [...getAllowedMimeTypes('image'), ...getAllowedMimeTypes('stl')];
    }
}
