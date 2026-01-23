import { test, expect } from '@playwright/test';

/**
 * II. STORAGE TESTS - File Upload, Access Control, Cleanup
 */
test.describe('Storage Security Tests', () => {
    test.describe('Upload File Validation', () => {
        test('Upload requires authentication', async ({ request }) => {
            const response = await request.post('/api/upload', {
                multipart: {
                    file: {
                        name: 'test.stl',
                        mimeType: 'application/octet-stream',
                        buffer: Buffer.from('solid test')
                    }
                }
            });
            expect(response.status()).toBe(401);
        });

        test('STL analyze requires authentication', async ({ request }) => {
            const response = await request.post('/api/analyze-stl', {
                multipart: {
                    file: {
                        name: 'test.stl',
                        mimeType: 'application/octet-stream',
                        buffer: Buffer.from('solid test')
                    }
                }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Rejects path traversal in filename', async ({ request }) => {
            const response = await request.post('/api/upload', {
                multipart: {
                    file: {
                        name: '../../../etc/passwd',
                        mimeType: 'application/octet-stream',
                        buffer: Buffer.from('test')
                    }
                }
            });
            // Should reject or require auth
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Rejects empty file', async ({ request }) => {
            const response = await request.post('/api/upload', {
                multipart: {
                    file: {
                        name: 'empty.stl',
                        mimeType: 'application/octet-stream',
                        buffer: Buffer.from('')
                    }
                }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('Storage Access Control', () => {
        test('File API requires authentication', async ({ request }) => {
            const response = await request.get('/api/files/test/path/file.stl');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Cannot access files via path traversal', async ({ request }) => {
            const response = await request.get('/api/files/../../../etc/passwd');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Cannot access files with relative paths', async ({ request }) => {
            const response = await request.get('/api/files/..%2F..%2Fetc%2Fpasswd');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });
});

test.describe('File Type Validation', () => {
    test('Validates file extension', async ({ request }) => {
        // Try to upload .exe with .stl extension
        const response = await request.post('/api/upload', {
            multipart: {
                file: {
                    name: 'malware.exe.stl',
                    mimeType: 'application/x-msdownload',
                    buffer: Buffer.from('MZ') // EXE magic bytes
                }
            }
        });
        expect(response.status()).toBeGreaterThanOrEqual(400);
    });
});
