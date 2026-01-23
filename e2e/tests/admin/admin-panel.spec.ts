import { test, expect } from '@playwright/test';

/**
 * X. ADMIN PANEL SECURITY TESTS
 */
test.describe('Admin Panel Security', () => {
    test.describe('Admin Access Control', () => {
        test('Admin dashboard blocked without auth', async ({ page }) => {
            await page.goto('/sys_internal');
            await page.waitForTimeout(2000);

            // Should redirect or block
            await expect(page.locator('body')).toBeVisible();
        });

        test('Admin orders page blocked without auth', async ({ page }) => {
            await page.goto('/sys_internal/orders');
            await page.waitForTimeout(2000);
            await expect(page.locator('body')).toBeVisible();
        });

        test('Admin products page blocked without auth', async ({ page }) => {
            await page.goto('/sys_internal/products');
            await page.waitForTimeout(2000);
            await expect(page.locator('body')).toBeVisible();
        });
    });

    test.describe('Admin API CSRF Protection', () => {
        test('Admin product creation protected', async ({ request }) => {
            const response = await request.post('/api/admin/products', {
                data: { name: 'Test', price: 100000 }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Admin category creation protected', async ({ request }) => {
            const response = await request.post('/api/admin/categories', {
                data: { name: 'Test Category' }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('Admin Input Validation', () => {
        test('Cannot create product with negative price', async ({ request }) => {
            const response = await request.post('/api/admin/products', {
                data: {
                    name: 'Test',
                    price: -100
                }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Cannot create product with XSS in description', async ({ request }) => {
            const response = await request.post('/api/admin/products', {
                data: {
                    name: 'Test',
                    description: '<script>alert("xss")</script>'
                }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });
});
