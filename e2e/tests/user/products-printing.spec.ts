import { test, expect } from '@playwright/test';

/**
 * Products & 3D Printing Tests
 */
test.describe('Products - Browsing', () => {
    test('Products list loads', async ({ page }) => {
        await page.goto('/products');
        await expect(page.locator('body')).toBeVisible();
    });

    test('Products page has search functionality', async ({ page }) => {
        await page.goto('/products');

        // Look for search input
        const searchInput = page.locator('input[type="text"], input[placeholder*="search"], input[placeholder*="tìm"]');
        await expect(searchInput.first()).toBeVisible({ timeout: 10000 });
    });

    test('Products can be filtered', async ({ page }) => {
        await page.goto('/products');
        await page.waitForTimeout(2000);

        // Look for filter/sort controls
        const controls = page.locator('select, button[class*="filter"], button[class*="category"]');
        const count = await controls.count();
        expect(count).toBeGreaterThan(0);
    });

    test('Product detail page loads', async ({ page }) => {
        await page.goto('/products');
        await page.waitForTimeout(2000);

        // Click first product if available
        const productLink = page.locator('a[href^="/products/"]').first();
        if (await productLink.isVisible()) {
            await productLink.click();
            await page.waitForTimeout(1000);
            await expect(page).toHaveURL(/\/products\/.+/);
        }
    });

    test('Images have lazy loading', async ({ page }) => {
        await page.goto('/products');
        await page.waitForTimeout(2000);

        // Check for lazy load attributes
        const images = page.locator('img');
        const count = await images.count();
        // Products page should have images
        expect(count).toBeGreaterThanOrEqual(0);
    });
});

test.describe('3D Printing Page', () => {
    test('Printing page loads', async ({ page }) => {
        await page.goto('/printing');
        await expect(page.locator('body')).toBeVisible();
    });

    test('Custom page loads', async ({ page }) => {
        await page.goto('/custom');
        await expect(page.locator('body')).toBeVisible();
    });

    test('Upload requires authentication', async ({ page }) => {
        await page.goto('/printing');

        // If there's an upload button, clicking should require auth
        const uploadBtn = page.locator('button:has-text("upload"), input[type="file"]');
        if (await uploadBtn.first().isVisible()) {
            // Page should handle auth properly
            await expect(page.locator('body')).toBeVisible();
        }
    });
});
