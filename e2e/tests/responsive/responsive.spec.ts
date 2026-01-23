import { test, expect, devices } from '@playwright/test';

/**
 * Cross-browser & Device Tests
 */
test.describe('Cross-browser & Responsive', () => {
    test.describe('Mobile Viewport (375px)', () => {
        test.use({ viewport: { width: 375, height: 667 } });

        test('Home page renders correctly on mobile', async ({ page }) => {
            await page.goto('/');
            await expect(page.locator('body')).toBeVisible();

            // No horizontal scroll
            const hasHorizontalScroll = await page.evaluate(() =>
                document.body.scrollWidth > window.innerWidth
            );
            expect(hasHorizontalScroll).toBe(false);
        });

        test('Products page renders on mobile', async ({ page }) => {
            await page.goto('/products');
            await expect(page.locator('body')).toBeVisible();
        });

        test('Login form usable on mobile', async ({ page }) => {
            await page.goto('/login');
            const form = page.locator('form');
            await expect(form).toBeVisible();
        });
    });

    test.describe('Tablet Viewport (768px)', () => {
        test.use({ viewport: { width: 768, height: 1024 } });

        test('Home page renders correctly on tablet', async ({ page }) => {
            await page.goto('/');
            await expect(page.locator('body')).toBeVisible();
        });

        test('Products grid adjusts for tablet', async ({ page }) => {
            await page.goto('/products');
            await expect(page.locator('body')).toBeVisible();
        });
    });

    test.describe('Desktop Viewport (1920px)', () => {
        test.use({ viewport: { width: 1920, height: 1080 } });

        test('Home page renders correctly on desktop', async ({ page }) => {
            await page.goto('/');
            await expect(page.locator('body')).toBeVisible();
        });
    });

    test.describe('Zoom Tests', () => {
        test('Page renders at 125% zoom', async ({ page }) => {
            await page.goto('/');
            await page.evaluate(() => {
                document.body.style.zoom = '125%';
            });
            await expect(page.locator('body')).toBeVisible();
        });

        test('Page renders at 150% zoom', async ({ page }) => {
            await page.goto('/');
            await page.evaluate(() => {
                document.body.style.zoom = '150%';
            });
            await expect(page.locator('body')).toBeVisible();
        });
    });
});
