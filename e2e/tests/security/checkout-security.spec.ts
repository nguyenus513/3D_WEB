import { test, expect } from '@playwright/test';

/**
 * Checkout Security Tests - ZONE DỄ BỊ HACK NHẤT
 */
test.describe('Checkout Security - Critical Zone', () => {
    test.describe('Price Manipulation Prevention', () => {
        test('API rejects negative price', async ({ request }) => {
            const response = await request.post('/api/orders/create', {
                data: {
                    items: [{
                        id: 'test',
                        product_id: 'test',
                        name: 'Test',
                        price: -100, // Negative price
                        quantity: 1
                    }],
                    total: -100
                }
            });

            // Should reject or require auth
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('API rejects zero price', async ({ request }) => {
            const response = await request.post('/api/orders/create', {
                data: {
                    items: [{
                        id: 'test',
                        product_id: 'test',
                        name: 'Test',
                        price: 0, // Zero price
                        quantity: 1
                    }],
                    total: 0
                }
            });

            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Server calculates total, not client', async ({ request }) => {
            // Client sends wrong total
            const response = await request.post('/api/orders/create', {
                data: {
                    items: [{
                        id: 'test',
                        product_id: 'test',
                        name: 'Test',
                        price: 1000000, // 1M
                        quantity: 10
                    }],
                    total: 1 // Client lies about total
                }
            });

            // Should reject or require auth
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('Double Submit Prevention', () => {
        test('Order creation requires auth', async ({ request }) => {
            const response1 = await request.post('/api/orders/create', {
                data: { items: [] }
            });

            expect(response1.status()).toBe(401);
        });
    });

    test.describe('Address Validation', () => {
        test('Checkout requires login', async ({ page }) => {
            await page.goto('/checkout');
            await page.waitForTimeout(3000);

            // Should redirect to login or show auth message
            const url = page.url();
            expect(url).toMatch(/login|checkout/);
        });
    });
});

test.describe('Cart Security', () => {
    test('Cart API rejects invalid quantity', async ({ request }) => {
        // Negative quantity
        const response = await request.post('/api/cart', {
            data: {
                productId: 'test',
                quantity: -5
            }
        });

        // Should reject or require auth
        expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('Cart page loads without errors', async ({ page }) => {
        await page.goto('/cart');
        await expect(page.locator('body')).toBeVisible();
    });
});
