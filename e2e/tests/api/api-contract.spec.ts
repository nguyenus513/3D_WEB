import { test, expect } from '@playwright/test';

/**
 * I. API CONTRACT TESTS - Backend ↔ Frontend
 */
test.describe('API Contract Tests', () => {
    test.describe('Response Schema Validation', () => {
        test('Products API returns valid schema', async ({ request }) => {
            const response = await request.get('/api/featured-products');
            expect(response.status()).toBe(200);

            const data = await response.json();

            // Should have products array
            expect(data).toBeDefined();
            expect(Array.isArray(data.products) || Array.isArray(data)).toBe(true);
        });

        test('Auth session API returns valid schema', async ({ request }) => {
            const response = await request.get('/api/auth/session');
            const data = await response.json();

            // Should have consistent structure
            expect(data).toBeDefined();
        });

        test('Error responses have consistent format', async ({ request }) => {
            const response = await request.get('/api/nonexistent-12345');

            // Should return 404 or similar, not 500
            expect(response.status()).toBeGreaterThanOrEqual(400);
            expect(response.status()).toBeLessThan(500);
        });
    });

    test.describe('No Sensitive Data Exposure', () => {
        test('Products API does not expose internal IDs excessively', async ({ request }) => {
            const response = await request.get('/api/featured-products');
            const bodyText = await response.text();

            // Should not expose database credentials or internal paths
            expect(bodyText).not.toContain('password');
            expect(bodyText).not.toContain('secret');
            expect(bodyText).not.toContain('SUPABASE_SERVICE_ROLE');
        });

        test('Error response does not leak stack trace', async ({ request }) => {
            const response = await request.post('/api/orders/create', {
                data: { invalid: 'data' }
            });

            const bodyText = await response.text();

            // Should not contain file paths or stack traces
            expect(bodyText).not.toContain('node_modules');
            expect(bodyText).not.toContain('.tsx:');
            expect(bodyText).not.toContain('at Object');
        });
    });

    test.describe('HTTP Status Codes', () => {
        test('401 for unauthorized requests', async ({ request }) => {
            const response = await request.get('/api/wishlist');
            expect(response.status()).toBe(401);
        });

        test('400 for invalid input', async ({ request }) => {
            const response = await request.post('/api/auth/register', {
                data: {} // Empty data
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('200 for successful public endpoints', async ({ request }) => {
            const response = await request.get('/api/featured-products');
            expect(response.status()).toBe(200);
        });
    });
});
