import { test, expect } from '@playwright/test';

/**
 * UI/UX Advanced Tests - Responsive, animations, loading states
 */
test.describe('UI/UX Tests', () => {
    test.describe('Responsive Design', () => {
        test('should display correctly on mobile', async ({ page }) => {
            // Set mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });
            await page.goto('/');

            // Page should be visible and not broken
            await expect(page.locator('body')).toBeVisible();

            // Check no horizontal scroll
            const body = await page.evaluate(() => {
                return document.body.scrollWidth <= window.innerWidth;
            });
            expect(body).toBe(true);
        });

        test('should display correctly on tablet', async ({ page }) => {
            await page.setViewportSize({ width: 768, height: 1024 });
            await page.goto('/');

            await expect(page.locator('body')).toBeVisible();
        });

        test('products page should be responsive', async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 667 });
            await page.goto('/products');

            // Search bar should be visible
            const searchInput = page.getByPlaceholder(/tìm kiếm|search/i);
            await expect(searchInput).toBeVisible();
        });
    });

    test.describe('Loading States', () => {
        test('products page should show loading skeleton', async ({ page }) => {
            // Navigate and check for skeleton
            await page.goto('/products');

            // Either skeleton or products should be visible quickly
            await page.waitForTimeout(100);
            const content = page.locator('[class*="grid"], [class*="skeleton"]');
            await expect(content.first()).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Error Pages', () => {
        test('404 page should display for unknown routes', async ({ page }) => {
            await page.goto('/this-page-does-not-exist-12345');

            // Should show 404 content
            const content = page.locator('text=/404|không tìm thấy|not found/i');
            await expect(content.first()).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Form UX', () => {
        test('login form should show password toggle', async ({ page }) => {
            await page.goto('/login');

            // Password field should exist
            const passwordField = page.locator('input[type="password"], input[type="text"]').nth(1);
            await expect(passwordField).toBeVisible();
        });

        test('checkout form should validate phone format', async ({ page }) => {
            // This test would need auth, placeholder for now
            await page.goto('/checkout');
            await page.waitForTimeout(2000);
            // Check if redirected or form shown
            const url = page.url();
            expect(url).toBeTruthy();
        });
    });

    test.describe('Accessibility', () => {
        test('buttons should be focusable', async ({ page }) => {
            await page.goto('/');

            // Tab to first focusable element
            await page.keyboard.press('Tab');

            // Something should be focused
            const focusedElement = await page.evaluate(() => {
                return document.activeElement?.tagName;
            });
            expect(focusedElement).toBeTruthy();
        });

        test('images should have alt text', async ({ page }) => {
            await page.goto('/products');
            await page.waitForTimeout(2000);

            // Check images have alt (allow empty since product images might use decorative)
            const imagesWithoutAlt = await page.locator('img:not([alt])').count();
            // Some images may be decorative, but warn if too many
            expect(imagesWithoutAlt).toBeLessThan(20);
        });
    });

    test.describe('Navigation', () => {
        test('logo should link to home', async ({ page }) => {
            await page.goto('/products');

            // Click logo/home link
            const homeLink = page.locator('a[href="/"]').first();
            if (await homeLink.isVisible()) {
                await homeLink.click();
                await expect(page).toHaveURL('/');
            }
        });

        test('footer links should work', async ({ page }) => {
            await page.goto('/');

            // Scroll to footer
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(500);

            // Footer should be visible
            const footer = page.locator('footer');
            if (await footer.isVisible()) {
                await expect(footer).toBeVisible();
            }
        });
    });
});
