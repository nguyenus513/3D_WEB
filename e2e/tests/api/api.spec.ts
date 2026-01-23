import { test, expect } from '@playwright/test';

/**
 * API Tests - Endpoint validation and responses
 */
test.describe('API Tests', () => {
    test.describe('Wishlist API', () => {
        test('GET /api/wishlist should require auth', async ({ request }) => {
            const response = await request.get('/api/wishlist');
            expect(response.status()).toBe(401);
        });

        test('POST /api/wishlist should require auth', async ({ request }) => {
            const response = await request.post('/api/wishlist', {
                data: { productId: '123' }
            });
            expect(response.status()).toBe(401);
        });

        test('DELETE /api/wishlist should require auth', async ({ request }) => {
            const response = await request.delete('/api/wishlist', {
                data: { productId: '123' }
            });
            expect(response.status()).toBe(401);
        });
    });

    test.describe('Order API', () => {
        test('POST /api/orders/create should require auth', async ({ request }) => {
            const response = await request.post('/api/orders/create', {
                data: {
                    items: [],
                    address: {}
                }
            });
            expect(response.status()).toBe(401);
        });
    });

    test.describe('Auth API', () => {
        test('POST /api/auth/register should validate input', async ({ request }) => {
            const response = await request.post('/api/auth/register', {
                data: {
                    email: 'invalid',
                    password: '123', // too short
                }
            });

            // Should reject invalid input
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('POST /api/auth/forgot-password should accept valid email', async ({ request }) => {
            const response = await request.post('/api/auth/forgot-password', {
                data: {
                    email: 'test@example.com'
                }
            });

            // Should return success even if email doesn't exist (security)
            expect(response.status()).toBeLessThan(500);
        });
    });

    test.describe('Admin API', () => {
        test('GET /api/admin/stats should require admin auth', async ({ request }) => {
            const response = await request.get('/api/admin/stats');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('GET /api/admin/products should require admin auth', async ({ request }) => {
            const response = await request.get('/api/admin/products');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('GET /api/admin/orders should require admin auth', async ({ request }) => {
            const response = await request.get('/api/admin/orders');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('GET /api/admin/customers should require admin auth', async ({ request }) => {
            const response = await request.get('/api/admin/customers');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('Public API', () => {
        test('GET /api/featured-products should return products', async ({ request }) => {
            const response = await request.get('/api/featured-products');
            expect(response.status()).toBe(200);

            const data = await response.json();
            expect(Array.isArray(data.products || data)).toBe(true);
        });
    });
});
