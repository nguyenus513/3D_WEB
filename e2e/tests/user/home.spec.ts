import { test, expect } from '@playwright/test';

/**
 * Home Page Tests
 */
test.describe('Home Page', () => {
    test('should load home page with hero section', async ({ page }) => {
        await page.goto('/');

        // Check page title
        await expect(page).toHaveTitle(/3D/);

        // Hero section should be visible
        const hero = page.locator('section').first();
        await expect(hero).toBeVisible();
    });

    test('should have navigation menu', async ({ page }) => {
        await page.goto('/');

        // Nav should be visible
        const nav = page.locator('nav');
        await expect(nav).toBeVisible();

        // Products link should exist
        const productsLink = page.getByRole('link', { name: /sản phẩm|products/i });
        await expect(productsLink).toBeVisible();
    });

    test('should navigate to products page', async ({ page }) => {
        await page.goto('/');

        // Click on products link
        await page.getByRole('link', { name: /sản phẩm|products/i }).first().click();

        // Should be on products page
        await expect(page).toHaveURL(/\/products/);
    });
});
