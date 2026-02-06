import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Buffer } from 'buffer';
import { UploadService } from '@/services/UploadService';

vi.mock('@/lib/google-drive-oauth', () => {
    return {
        isDriveConnected: vi.fn(),
        uploadToPath: vi.fn(),
        getDirectUrl: vi.fn((id: string) => `direct-${id}`),
        getThumbnailUrl: vi.fn((id: string) => `thumb-${id}`),
        getDownloadUrl: vi.fn((id: string) => `download-${id}`),
    };
});

vi.mock('@/lib/storage/r2', () => {
    return {
        isR2Configured: vi.fn(),
        uploadToR2: vi.fn(),
    };
});

vi.mock('@/lib/security/file-access', () => {
    return {
        trackFileUpload: vi.fn(),
    };
});

vi.mock('@/lib/security/file-validation', () => {
    return {
        validateUploadedFile: vi.fn(() => ({ valid: true })),
    };
});

import {
    isDriveConnected,
    uploadToPath,
    getDownloadUrl,
} from '@/lib/google-drive-oauth';
import { isR2Configured, uploadToR2 } from '@/lib/storage/r2';
import { trackFileUpload } from '@/lib/security/file-access';

const makeBuffer = (text = 'data') => Buffer.from(text);

describe('UploadService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uploads STL/OBJ/3MF to Drive and tracks drive metadata', async () => {
        (isDriveConnected as any).mockResolvedValue(true);
        (uploadToPath as any).mockResolvedValue({
            fileId: 'drive123',
            fileName: 'model.stl',
            webViewLink: 'view',
            webContentLink: 'download',
        });

        const service = new UploadService();
        const file = new File([makeBuffer()], 'model.stl', { type: 'application/sla' });
        const buffer = makeBuffer();

        const result = await service.uploadFile(
            file,
            buffer,
            {
                type: 'printing',
                orderCode: 'ORD001',
                customerCode: 'CUS001',
                tech: 'fdm',
                index: 1,
            } as any,
            'user-1',
            false
        );

        expect(result.storage).toBe('drive');
        expect(result.file.url).toBe('download-drive123');
        expect(getDownloadUrl).toHaveBeenCalledWith('drive123');
        expect(trackFileUpload).toHaveBeenCalledWith(
            expect.any(String),
            'user-1',
            expect.objectContaining({
                storageProvider: 'drive',
                driveFileId: 'drive123',
                driveUrl: 'download-drive123',
            })
        );
        expect(uploadToR2).not.toHaveBeenCalled();
    });

    it('falls back to Drive when R2 upload fails and Drive is connected', async () => {
        (isR2Configured as any).mockReturnValue(true);
        (uploadToR2 as any).mockRejectedValue(new Error('R2 error'));
        (isDriveConnected as any).mockResolvedValue(true);
        (uploadToPath as any).mockResolvedValue({
            fileId: 'drive456',
            fileName: 'photo.png',
            webViewLink: 'view',
            webContentLink: 'download',
        });

        const service = new UploadService();
        const file = new File([makeBuffer()], 'photo.png', { type: 'image/png' });
        const buffer = makeBuffer();

        const result = await service.uploadFile(
            file,
            buffer,
            {
                type: 'custom_single',
                orderCode: 'ORD002',
                customerCode: 'CUS002',
                index: 1,
                photoCategory: 'main',
                customType: 'single',
                personCount: 1,
            } as any,
            'user-2',
            false
        );

        expect(result.storage).toBe('drive');
        expect(uploadToPath).toHaveBeenCalled();
        expect(trackFileUpload).toHaveBeenCalledWith(
            expect.any(String),
            'user-2',
            expect.objectContaining({
                storageProvider: 'drive',
                driveFileId: 'drive456',
            })
        );
    });
});
