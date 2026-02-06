import { describe, it, expect } from 'vitest';
import { getStorageDestination, isModelFile } from '@/lib/storage/storage-policy';

describe('storage-policy', () => {
    it('detects model files by extension and mime type', () => {
        expect(isModelFile('model.stl')).toBe(true);
        expect(isModelFile('model.OBJ')).toBe(true);
        expect(isModelFile('model.3mf')).toBe(true);
        expect(isModelFile('file', 'model/3mf')).toBe(true);
        expect(isModelFile('file', 'application/vnd.ms-package.3dmanufacturing-3dmodel')).toBe(true);
        expect(isModelFile('photo.png')).toBe(false);
    });

    it('routes models to drive and images to r2', () => {
        expect(getStorageDestination('model.stl')).toBe('drive');
        expect(getStorageDestination('model.obj')).toBe('drive');
        expect(getStorageDestination('model.3mf')).toBe('drive');
        expect(getStorageDestination('photo.jpg')).toBe('r2');
        expect(getStorageDestination('image.png')).toBe('r2');
    });
});
