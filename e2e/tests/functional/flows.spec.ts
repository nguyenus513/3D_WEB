import { test, expect } from '@playwright/test';

// Test credentials from environment variables - NEVER hardcode passwords!
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'test-admin@example.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';
const USER_EMAIL = process.env.TEST_USER_EMAIL || 'test-user@example.com';
const USER_PASSWORD = process.env.TEST_USER_PASSWORD || '';

// Skip tests if credentials not configured
const skipIfNoCredentials = !ADMIN_PASSWORD || !USER_PASSWORD;

test.describe('Admin Panel Functional Tests', () => {
    test.skip(skipIfNoCredentials, 'Credentials not configured in environment');

    test('Admin can login and access dashboard', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
        await page.fill('input[type="password"], input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');

        await page.waitForURL('**/sys_internal**', { timeout: 15000 });
        expect(page.url()).toContain('/sys_internal');
    });

    test('Admin can view orders list', async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
        await page.fill('input[type="password"], input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL('**/sys_internal**', { timeout: 15000 });

        await page.goto('/sys_internal/orders');
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain('/orders');
    });

    test('Admin can view products list', async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
        await page.fill('input[type="password"], input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL('**/sys_internal**', { timeout: 15000 });

        await page.goto('/sys_internal/products');
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain('/products');
    });
});

test.describe('User Flow Tests', () => {
    test('User can login successfully', async ({ page }) => {
        test.skip(skipIfNoCredentials, 'Credentials not configured');

        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        await page.fill('input[type="email"], input[name="email"]', USER_EMAIL);
        await page.fill('input[type="password"], input[name="password"]', USER_PASSWORD);
        await page.click('button[type="submit"]');

        await page.waitForURL(/\/(account|$)/, { timeout: 15000 });
        expect(page.url()).not.toContain('/login');
    });

    test('User can browse products', async ({ page }) => {
        await page.goto('/products');
        await page.waitForLoadState('networkidle');

        const products = page.locator('[data-testid="product-card"], .product-card, article, a[href*="/products/"]');
        await expect(products.first()).toBeVisible({ timeout: 10000 });
    });

    test('User can view product details', async ({ page }) => {
        await page.goto('/products');
        await page.waitForLoadState('networkidle');

        const firstProduct = page.locator('a[href*="/products/"]').first();
        await expect(firstProduct).toBeVisible({ timeout: 10000 });
        await firstProduct.click();

        await page.waitForURL('**/products/**', { timeout: 10000 });
        expect(page.url()).toMatch(/\/products\/[a-zA-Z0-9-]+/);
    });

    test('User can access cart', async ({ page }) => {
        await page.goto('/cart');
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain('/cart');
    });

    test('Authenticated user can access account', async ({ page }) => {
        test.skip(skipIfNoCredentials, 'Credentials not configured');

        await page.goto('/login');
        await page.fill('input[type="email"], input[name="email"]', USER_EMAIL);
        await page.fill('input[type="password"], input[name="password"]', USER_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(/\/(account|$)/, { timeout: 15000 });

        await page.goto('/account');
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain('/account');
    });
});
