import { afterEach, describe, expect, it, vi } from 'vitest';

import { compressImageForUpload, prepareImageForServerUpload } from '@/lib/utils/imageCompression';

function makeFile(size: number, type = 'image/png', name = 'ảnh gốc.png') {
    return new File([new Uint8Array(size)], name, { type });
}

describe('imageCompression', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('keeps small images unchanged', async () => {
        const file = makeFile(1024);

        const result = await compressImageForUpload(file, { maxBytes: 2048 });

        expect(result.file).toBe(file);
        expect(result.compressed).toBe(false);
        expect(result.outputBytes).toBe(file.size);
    });

    it('skips image types that should not be recompressed', async () => {
        const file = makeFile(4096, 'image/gif', 'animation.gif');

        const result = await compressImageForUpload(file, { maxBytes: 1024 });

        expect(result.file).toBe(file);
        expect(result.compressed).toBe(false);
    });

    it('throws when the image is still too large for server upload', async () => {
        const file = makeFile(4096, 'image/svg+xml', 'vector.svg');

        await expect(prepareImageForServerUpload(file, { maxBytes: 1024 })).rejects.toThrow('Ảnh quá lớn');
    });

    it('resizes and converts large images before upload', async () => {
        const createObjectURL = vi.fn(() => 'blob:test-image');
        const revokeObjectURL = vi.fn();

        vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
        vi.stubGlobal('Image', class MockImage {
            width = 3200;
            height = 1600;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;

            set src(_value: string) {
                this.onload?.();
            }
        });

        const drawImage = vi.fn();
        const toBlob = vi.fn((callback: (blob: Blob) => void, type: string) => {
            callback(new Blob([new Uint8Array(2048)], { type }));
        });

        vi.stubGlobal('document', {
            createElement: vi.fn(() => ({
                width: 0,
                height: 0,
                getContext: vi.fn(() => ({ drawImage })),
                toBlob,
            })),
        });

        const file = makeFile(8192, 'image/png', 'khách hàng.png');

        const result = await prepareImageForServerUpload(file, { maxBytes: 4096, maxDimension: 1600 });

        expect(result.compressed).toBe(true);
        expect(result.file.type).toBe('image/jpeg');
        expect(result.file.name).toBe('khách hàng.jpg');
        expect(result.file.size).toBe(2048);
        expect(result.width).toBe(1600);
        expect(result.height).toBe(800);
        expect(createObjectURL).toHaveBeenCalledWith(file);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-image');
        expect(drawImage).toHaveBeenCalled();
    });
});
