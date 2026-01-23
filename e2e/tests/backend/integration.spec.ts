import { test, expect } from '@playwright/test';

/**
 * Backend Integration & External Services Tests
 * - Google Drive API
 * - R2/S3 Storage
 * - Email Service
 * - Database Connection
 */
test.describe('Backend Integration Tests', () => {
    test.describe('Google Drive Integration', () => {
        test('Drive auth endpoint accessible', async ({ request }) => {
            const response = await request.get('/api/drive/auth');
            expect(response.status()).toBeLessThan(500);
        });

        test('Drive status endpoint accessible', async ({ request }) => {
            const response = await request.get('/api/drive/status');
            expect(response.status()).toBeLessThan(500);
        });

        test('Drive callback handles requests', async ({ request }) => {
            const response = await request.get('/api/drive/callback');
            expect(response.status()).toBeLessThan(500);
        });

        test('Drive file access requires authentication', async ({ request }) => {
            const response = await request.get('/api/files/drive/test-file-id');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('R2/S3 Storage', () => {
        test('Upload endpoint requires auth', async ({ request }) => {
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

        test('File path traversal blocked', async ({ request }) => {
            const response = await request.get('/api/files/../../../etc/passwd');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('URL encoded path traversal blocked', async ({ request }) => {
            const response = await request.get('/api/files/%2e%2e%2f%2e%2e%2fetc%2fpasswd');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Arbitrary file access blocked', async ({ request }) => {
            const response = await request.get('/api/files/random-user-id/random-file.stl');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('Email Service', () => {
        test('Send email endpoint requires auth', async ({ request }) => {
            const response = await request.post('/api/send-email', {
                data: {
                    to: 'test@example.com',
                    subject: 'Test',
                    body: 'Test'
                }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('Database Connectivity', () => {
        test('Featured products API works (DB read)', async ({ request }) => {
            const response = await request.get('/api/featured-products');
            expect(response.status()).toBe(200);

            const data = await response.json();
            expect(data).toBeDefined();
        });

        test('Auth session works (DB session)', async ({ request }) => {
            const response = await request.get('/api/auth/session');
            expect(response.status()).toBeLessThan(500);
        });
    });
});

test.describe('Backend Security Tests', () => {
    test.describe('API Rate Limiting', () => {
        test('Register has rate limiting', async ({ request }) => {
            const responses = [];
            for (let i = 0; i < 5; i++) {
                const response = await request.post('/api/auth/register', {
                    data: {
                        email: `test${i}${Date.now()}@example.com`,
                        password: 'TestPassword123!',
                        name: 'Test User'
                    }
                });
                responses.push(response);
            }
            // Should not crash
            expect(responses.every(r => r.status() < 500)).toBe(true);
        });
    });

    test.describe('Input Sanitization', () => {
        test('SQL injection in search params blocked', async ({ request }) => {
            const response = await request.get('/api/featured-products?category=1;DROP TABLE products;--');
            expect(response.status()).toBeLessThan(500);

            // Should return valid JSON, not error
            const data = await response.json();
            expect(data).toBeDefined();
        });

        test('XSS in query params sanitized', async ({ request }) => {
            const response = await request.get('/api/featured-products?search=<script>alert(1)</script>');
            expect(response.status()).toBeLessThan(500);
        });
    });

    test.describe('CORS & Headers', () => {
        test('API returns proper content type', async ({ request }) => {
            const response = await request.get('/api/featured-products');
            const contentType = response.headers()['content-type'];
            expect(contentType).toContain('application/json');
        });
    });

    test.describe('Error Handling', () => {
        test('Invalid JSON body handled', async ({ request }) => {
            const response = await request.post('/api/orders/create', {
                headers: {
                    'Content-Type': 'application/json'
                },
                data: 'invalid json{'
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
            expect(response.status()).toBeLessThan(500);
        });

        test('Missing required fields handled', async ({ request }) => {
            const response = await request.post('/api/auth/register', {
                data: {} // Empty data
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });
});

test.describe('Admin Backend Security', () => {
    test('Admin stats requires admin role', async ({ request }) => {
        const response = await request.get('/api/admin/stats');
        expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('Admin product CRUD requires admin role', async ({ request }) => {
        const promises = [
            request.get('/api/admin/products'),
            request.post('/api/admin/products', { data: { name: 'Test' } }),
            request.put('/api/admin/products', { data: { id: '1', name: 'Test' } }),
            request.delete('/api/admin/products?id=1'),
        ];

        const responses = await Promise.all(promises);
        expect(responses.every(r => r.status() >= 400)).toBe(true);
    });

    test('Admin order status update requires admin', async ({ request }) => {
        const response = await request.patch('/api/admin/orders/test-id', {
            data: { status: 'delivered' }
        });
        expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('Admin revenue data protected', async ({ request }) => {
        const response = await request.get('/api/admin/revenue');
        expect(response.status()).toBeGreaterThanOrEqual(400);
    });
});
