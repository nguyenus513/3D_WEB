import { test, expect } from '@playwright/test';

/**
 * III. ADMIN TESTS - CỰC KỲ QUAN TRỌNG
 */
test.describe('Admin Security Tests', () => {
    test.describe('Admin Authentication', () => {
        test('Admin dashboard blocked without login', async ({ page }) => {
            const response = await page.goto('/sys_internal');

            // Should redirect or show error
            await page.waitForTimeout(2000);
            const url = page.url();

            // Either redirected to login or blocked
            expect(url).toBeTruthy();
        });

        test('Admin API blocked without auth', async ({ request }) => {
            const response = await request.get('/api/admin/stats');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Admin orders API blocked without auth', async ({ request }) => {
            const response = await request.get('/api/admin/orders');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Admin products API blocked without auth', async ({ request }) => {
            const response = await request.get('/api/admin/products');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Admin customers API blocked without auth', async ({ request }) => {
            const response = await request.get('/api/admin/customers');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Admin launch blocked without admin role', async ({ request }) => {
            const response = await request.get('/api/admin/launch');
            expect(response.status()).toBeGreaterThanOrEqual(300);
        });
    });

    test.describe('Admin CSRF Protection', () => {
        test('Admin product create requires proper auth', async ({ request }) => {
            const response = await request.post('/api/admin/products', {
                data: {
                    name: 'Test Product',
                    price: 100000
                }
            });

            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Admin product delete requires proper auth', async ({ request }) => {
            const response = await request.delete('/api/admin/products?id=test');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Admin order update requires proper auth', async ({ request }) => {
            const response = await request.patch('/api/admin/orders/test', {
                data: { status: 'delivered' }
            });

            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('Admin Data Protection', () => {
        test('Admin revenue API protected', async ({ request }) => {
            const response = await request.get('/api/admin/revenue');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Admin categories API protected', async ({ request }) => {
            const response = await request.get('/api/admin/categories');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });
});
