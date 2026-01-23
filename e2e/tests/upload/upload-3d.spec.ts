import { test, expect } from '@playwright/test';

/**
 * VII. CUSTOM 3D UPLOAD SECURITY TESTS
 */
test.describe('Custom 3D Upload Security', () => {
    test.describe('File Type Validation', () => {
        test('Rejects non-STL/OBJ files', async ({ request }) => {
            const response = await request.post('/api/upload', {
                multipart: {
                    file: {
                        name: 'malware.exe',
                        mimeType: 'application/x-msdownload',
                        buffer: Buffer.from('MZ') // EXE signature
                    }
                }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Rejects renamed executable', async ({ request }) => {
            // EXE renamed to .stl
            const response = await request.post('/api/upload', {
                multipart: {
                    file: {
                        name: 'model.stl',
                        mimeType: 'application/octet-stream',
                        buffer: Buffer.from('MZ') // EXE signature
                    }
                }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Rejects script in file', async ({ request }) => {
            const response = await request.post('/api/upload', {
                multipart: {
                    file: {
                        name: 'model.stl',
                        mimeType: 'application/octet-stream',
                        buffer: Buffer.from('<script>alert("xss")</script>')
                    }
                }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Rejects corrupted/empty file', async ({ request }) => {
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

    test.describe('STL Analysis Security', () => {
        test('Analyze STL requires auth', async ({ request }) => {
            const response = await request.post('/api/analyze-stl', {
                multipart: {
                    file: {
                        name: 'model.stl',
                        mimeType: 'application/octet-stream',
                        buffer: Buffer.from('solid model\nendsolid')
                    }
                }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('Access Control', () => {
        test('File access requires authentication', async ({ request }) => {
            const response = await request.get('/api/files/user123/model.stl');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });
});
