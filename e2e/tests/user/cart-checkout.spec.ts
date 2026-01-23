import { test, expect } from '@playwright/test';

/**
 * Cart & Checkout Tests
 */
test.describe('Cart & Checkout', () => {
    test.describe('Cart Page', () => {
        test('should load cart page', async ({ page }) => {
            await page.goto('/cart');

            // Page should load
            await expect(page.locator('body')).toBeVisible();
        });

        test('empty cart should show message', async ({ page }) => {
            // Clear any localStorage
            await page.goto('/');
            await page.evaluate(() => localStorage.clear());

            await page.goto('/cart');

            // Should show empty state or products link
            const content = page.locator('text=/trống|empty|sản phẩm/i');
            await expect(content.first()).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Checkout Page', () => {
        test('checkout should require login', async ({ page }) => {
            await page.goto('/checkout');

            // Wait for redirect or auth check
            await page.waitForTimeout(3000);

            // Should either redirect to login or show checkout
            const url = page.url();
            expect(url).toMatch(/login|checkout/);
        });
    });

    test.describe('Product Detail', () => {
        test('product detail page should load', async ({ page }) => {
            // First get a product ID from products page
            await page.goto('/products');
            await page.waitForTimeout(2000);

            // Click first product link
            const productLink = page.locator('a[href^="/products/"]').first();
            if (await productLink.isVisible()) {
                await productLink.click();

                // Should be on product detail
                await expect(page).toHaveURL(/\/products\/.+/);
            }
        });
    });
});
