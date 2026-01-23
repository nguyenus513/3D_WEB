import { test, expect } from '@playwright/test';

// Test admin credentials - should be in .env.test
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'adminpassword';

/**
 * Admin Dashboard Tests
 */
test.describe('Admin Dashboard', () => {
    // This test requires valid admin credentials
    test.skip(({ browserName }) => !process.env.TEST_ADMIN_EMAIL, 'Skipping - no admin credentials');

    test.beforeEach(async ({ page }) => {
        // Login as admin
        await page.goto('/login');
        await page.getByPlaceholder(/email/i).fill(ADMIN_EMAIL);
        await page.getByPlaceholder(/mật khẩu|password/i).fill(ADMIN_PASSWORD);
        await page.getByRole('button', { name: /đăng nhập/i }).click();

        // Wait for redirect to admin
        await page.waitForURL(/sys_internal|admin/, { timeout: 10000 });
    });

    test('should display dashboard stats', async ({ page }) => {
        // Stats cards should be visible
        const statsCards = page.locator('[class*="grid"] > a, [class*="grid"] > div');
        await expect(statsCards.first()).toBeVisible();
    });

    test('should display recent orders table', async ({ page }) => {
        // Orders table should be visible
        const ordersTable = page.locator('table');
        await expect(ordersTable).toBeVisible();
    });

    test('should navigate to orders page', async ({ page }) => {
        // Click on orders link
        await page.getByRole('link', { name: /đơn hàng|orders/i }).first().click();

        // Should be on orders page
        await expect(page).toHaveURL(/orders/);
    });

    test('should navigate to products page', async ({ page }) => {
        // Click on products link
        await page.getByRole('link', { name: /sản phẩm|products/i }).first().click();

        // Should be on products page
        await expect(page).toHaveURL(/products/);
    });
});
