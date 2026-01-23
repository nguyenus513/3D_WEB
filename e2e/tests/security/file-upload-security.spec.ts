import { test, expect } from '@playwright/test';

/**
 * File Upload Security Tests - CỰC KỲ QUAN TRỌNG
 */
test.describe('File Upload Security', () => {
    test.describe('Upload API Protection', () => {
        test('Upload requires authentication', async ({ request }) => {
            const response = await request.post('/api/upload', {
                multipart: {
                    file: {
                        name: 'test.stl',
                        mimeType: 'application/octet-stream',
                        buffer: Buffer.from('test content')
                    }
                }
            });

            expect(response.status()).toBe(401);
        });

        test('Analyze STL requires authentication', async ({ request }) => {
            const response = await request.post('/api/analyze-stl', {
                multipart: {
                    file: {
                        name: 'test.stl',
                        mimeType: 'application/octet-stream',
                        buffer: Buffer.from('test content')
                    }
                }
            });

            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('File Access Protection', () => {
        test('Files API requires authentication', async ({ request }) => {
            const response = await request.get('/api/files/test/path/file.stl');

            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Cannot access other user files via path traversal', async ({ request }) => {
            const response = await request.get('/api/files/../../../etc/passwd');

            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });
});

test.describe('IDOR Prevention - Order Access', () => {
    test('Cannot access order by guessing ID without auth', async ({ request }) => {
        // Try to access random order ID
        const response = await request.get('/api/orders/12345');

        expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('Admin order endpoint requires admin auth', async ({ request }) => {
        const response = await request.get('/api/admin/orders/12345');

        expect(response.status()).toBeGreaterThanOrEqual(400);
    });
});
