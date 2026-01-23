import { test, expect } from '@playwright/test';

/**
 * Products Page Tests
 */
test.describe('Products Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/products');
    });

    test('should load products page', async ({ page }) => {
        // Page should have products heading
        const heading = page.getByRole('heading', { level: 1 });
        await expect(heading).toBeVisible();
    });

    test('should display search bar', async ({ page }) => {
        // Search input should be visible
        const searchInput = page.getByPlaceholder(/tìm kiếm|search/i);
        await expect(searchInput).toBeVisible();
    });

    test('should have sort dropdown', async ({ page }) => {
        // Sort select should be visible
        const sortSelect = page.locator('select');
        await expect(sortSelect).toBeVisible();
    });

    test('should filter products by search', async ({ page }) => {
        // Type in search box
        const searchInput = page.getByPlaceholder(/tìm kiếm|search/i);
        await searchInput.fill('test');

        // Wait for filter to apply
        await page.waitForTimeout(500);

        // Results count should update
        const resultsText = page.locator('text=/\\d+ sản phẩm/');
        await expect(resultsText).toBeVisible();
    });

    test('should sort products', async ({ page }) => {
        // Select sort option
        const sortSelect = page.locator('select');
        await sortSelect.selectOption('price_asc');

        // Products should reorder (basic check)
        const products = page.locator('[class*="grid"] > div');
        await expect(products.first()).toBeVisible();
    });

    test('should have category tabs', async ({ page }) => {
        // "Tất cả" tab should be visible
        const allTab = page.getByRole('button', { name: /tất cả/i });
        await expect(allTab).toBeVisible();
    });
});
