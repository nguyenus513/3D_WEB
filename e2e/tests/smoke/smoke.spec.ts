import { test, expect } from '@playwright/test';

/**
 * I. SMOKE TESTS - Hệ thống sống/chết
 */
test.describe('Smoke Tests - System Health', () => {
    test('Website loads successfully', async ({ page }) => {
        const response = await page.goto('/');
        expect(response?.status()).toBeLessThan(400);
        await expect(page.locator('body')).toBeVisible();
    });

    test('Products page loads', async ({ page }) => {
        const response = await page.goto('/products');
        expect(response?.status()).toBeLessThan(400);
    });

    test('Login page loads', async ({ page }) => {
        const response = await page.goto('/login');
        expect(response?.status()).toBeLessThan(400);
    });

    test('Register page loads', async ({ page }) => {
        const response = await page.goto('/register');
        expect(response?.status()).toBeLessThan(400);
    });

    test('Cart page loads', async ({ page }) => {
        const response = await page.goto('/cart');
        expect(response?.status()).toBeLessThan(400);
    });

    test('Printing page loads', async ({ page }) => {
        const response = await page.goto('/printing');
        expect(response?.status()).toBeLessThan(400);
    });

    test('Custom page loads', async ({ page }) => {
        const response = await page.goto('/custom');
        expect(response?.status()).toBeLessThan(400);
    });

    test('FAQ page loads', async ({ page }) => {
        const response = await page.goto('/faq');
        expect(response?.status()).toBeLessThan(400);
    });

    test('About page loads', async ({ page }) => {
        const response = await page.goto('/about');
        expect(response?.status()).toBeLessThan(400);
    });
});

test.describe('API Health Check', () => {
    test('Featured products API responds', async ({ request }) => {
        const response = await request.get('/api/featured-products');
        expect(response.status()).toBe(200);
    });

    test('Auth session API responds', async ({ request }) => {
        const response = await request.get('/api/auth/session');
        expect(response.status()).toBeLessThan(500);
    });
});
