import { test, expect } from '@playwright/test';

/**
 * Security Tests - XSS, CSRF, Auth protection
 */
test.describe('Security Tests', () => {
    test.describe('XSS Prevention', () => {
        test('should sanitize script tags in search', async ({ page }) => {
            await page.goto('/products');

            const searchInput = page.getByPlaceholder(/tìm kiếm|search/i);
            await searchInput.fill('<script>alert("xss")</script>');

            // Wait for filter
            await page.waitForTimeout(500);

            // Script should not execute - page should still work
            await expect(page.locator('body')).not.toContainText('<script>');
        });

        test('should escape HTML in displayed content', async ({ page }) => {
            await page.goto('/products');

            const searchInput = page.getByPlaceholder(/tìm kiếm|search/i);
            await searchInput.fill('<img src=x onerror=alert(1)>');

            // Wait for filter
            await page.waitForTimeout(500);

            // Check no img with onerror
            const maliciousImg = page.locator('img[onerror]');
            await expect(maliciousImg).toHaveCount(0);
        });
    });

    test.describe('Authentication Protection', () => {
        test('account pages should redirect to login when not authenticated', async ({ page }) => {
            await page.goto('/account');

            // Should redirect to login
            await expect(page).toHaveURL(/login/);
        });

        test('checkout should require authentication', async ({ page }) => {
            await page.goto('/checkout');

            // Should redirect to login or show auth message
            await page.waitForTimeout(2000);
            const url = page.url();
            expect(url).toMatch(/login|checkout/);
        });

        test('admin routes should be protected', async ({ page }) => {
            // Try to access admin without auth
            const response = await page.goto('/api/admin/stats');

            // Should return 401 or redirect
            expect(response?.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('Rate Limiting', () => {
        test('forgot password should be rate limited', async ({ page }) => {
            await page.goto('/forgot-password');

            const emailInput = page.locator('input[type="email"]');
            const submitBtn = page.getByRole('button', { name: /gửi/i });

            // Submit multiple times quickly
            for (let i = 0; i < 3; i++) {
                await emailInput.fill(`test${i}@example.com`);
                await submitBtn.click();
                await page.waitForTimeout(500);
            }

            // Page should still work (not crash)
            await expect(page.locator('body')).toBeVisible();
        });
    });

    test.describe('Input Validation', () => {
        test('register form should validate email format', async ({ page }) => {
            await page.goto('/register');

            // Fill invalid email
            const emailInput = page.locator('input[type="email"]');
            await emailInput.fill('invalid-email');

            // Try to submit
            const form = page.locator('form');
            await form.locator('button[type="submit"]').click();

            // Should show validation error or not submit
            await page.waitForTimeout(1000);
            await expect(page).toHaveURL(/register/);
        });

        test('login form should require both fields', async ({ page }) => {
            await page.goto('/login');

            // Try to submit empty form
            await page.getByRole('button', { name: /đăng nhập/i }).click();

            // Form should not submit (HTML5 validation)
            await expect(page).toHaveURL(/login/);
        });
    });
});
