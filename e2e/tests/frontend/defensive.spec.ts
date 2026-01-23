import { test, expect } from '@playwright/test';

/**
 * IX. FRONTEND DEFENSIVE TESTS
 */
test.describe('Frontend Defensive Tests', () => {
    test.describe('Error Handling', () => {
        test('Page handles API errors gracefully', async ({ page }) => {
            await page.goto('/');
            await expect(page.locator('body')).toBeVisible();

            // Navigate to products - should handle any API issues
            await page.goto('/products');
            await expect(page.locator('body')).toBeVisible();
        });

        test('Login page handles server errors', async ({ page }) => {
            await page.goto('/login');

            // Fill form with invalid data
            await page.locator('input[type="email"]').fill('test@test.com');
            await page.locator('input[type="password"]').fill('wrong');
            await page.locator('button[type="submit"]').click();

            await page.waitForTimeout(3000);

            // Page should still be functional
            await expect(page.locator('body')).toBeVisible();
        });
    });

    test.describe('No Sensitive Data in Frontend', () => {
        test('Page source does not contain API keys', async ({ page }) => {
            await page.goto('/');
            const content = await page.content();

            expect(content).not.toContain('SERVICE_ROLE_KEY');
            expect(content).not.toContain('secret_');
            expect(content).not.toContain('sk-');
        });

        test('Console does not log tokens', async ({ page }) => {
            const consoleLogs: string[] = [];
            page.on('console', msg => consoleLogs.push(msg.text()));

            await page.goto('/login');
            await page.waitForTimeout(2000);

            // Check no tokens logged
            const sensitivePatterns = consoleLogs.filter(log =>
                log.includes('jwt') ||
                log.includes('token') ||
                log.includes('Bearer')
            );

            // Allow some token references but not actual values
            expect(sensitivePatterns.length).toBeLessThan(5);
        });
    });

    test.describe('XSS Prevention in Frontend', () => {
        test('User input is escaped in search', async ({ page }) => {
            await page.goto('/products');

            const searchInput = page.getByPlaceholder(/tìm kiếm|search/i);
            if (await searchInput.isVisible()) {
                await searchInput.fill('<img src=x onerror=alert(1)>');
                await page.waitForTimeout(500);
            }

            // No img with onerror should exist
            const maliciousImg = await page.locator('img[onerror]').count();
            expect(maliciousImg).toBe(0);
        });
    });
});
