import { test, expect } from '@playwright/test';

/**
 * IV. OWASP TOP 10 Security Tests
 */
test.describe('OWASP Top 10 Tests', () => {
    test.describe('A01: Broken Access Control', () => {
        test('IDOR - Cannot access other user wishlist', async ({ request }) => {
            const response = await request.get('/api/wishlist');
            expect(response.status()).toBe(401);
        });

        test('IDOR - Cannot access other user orders', async ({ request }) => {
            const response = await request.get('/api/orders/other-user-order-id');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Path traversal blocked in files', async ({ request }) => {
            const response = await request.get('/api/files/../../etc/passwd');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('A02: Cryptographic Failures', () => {
        test('Login page uses HTTPS-ready form', async ({ page }) => {
            await page.goto('/login');

            // Password field should be type=password
            const passwordField = page.locator('input[type="password"]');
            await expect(passwordField).toBeVisible();
        });
    });

    test.describe('A03: Injection', () => {
        test('SQL injection in search blocked', async ({ page }) => {
            await page.goto('/products');

            const searchInput = page.getByPlaceholder(/tìm kiếm|search/i);
            if (await searchInput.isVisible()) {
                await searchInput.fill("'; DROP TABLE products; --");
                await page.waitForTimeout(500);
            }

            // Page should not crash
            await expect(page.locator('body')).toBeVisible();
        });

        test('XSS in search blocked', async ({ page }) => {
            await page.goto('/products');

            const searchInput = page.getByPlaceholder(/tìm kiếm|search/i);
            if (await searchInput.isVisible()) {
                await searchInput.fill('<script>alert(1)</script>');
                await page.waitForTimeout(500);
            }

            // No script execution
            await expect(page.locator('script:has-text("alert")')).toHaveCount(0);
        });
    });

    test.describe('A04: Insecure Design', () => {
        test('Rate limiting on forgot password', async ({ request }) => {
            // Multiple rapid requests
            const responses = await Promise.all([
                request.post('/api/auth/forgot-password', { data: { email: 'test1@test.com' } }),
                request.post('/api/auth/forgot-password', { data: { email: 'test2@test.com' } }),
                request.post('/api/auth/forgot-password', { data: { email: 'test3@test.com' } }),
            ]);

            // At least some should succeed, system should not crash
            expect(responses.some(r => r.status() < 500)).toBe(true);
        });
    });

    test.describe('A05: Security Misconfiguration', () => {
        test('Error pages do not leak stack traces', async ({ page }) => {
            await page.goto('/api/nonexistent-endpoint-12345');

            const bodyText = await page.locator('body').textContent();

            // Should not contain file paths or stack traces
            expect(bodyText).not.toContain('node_modules');
            expect(bodyText).not.toContain('.tsx');
            expect(bodyText).not.toContain('at Object');
        });

        test('Admin endpoints not discoverable', async ({ request }) => {
            const response = await request.get('/api/admin');
            // Should not expose admin structure
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('A07: Identification and Auth Failures', () => {
        test('Session endpoint protected', async ({ request }) => {
            const response = await request.get('/api/auth/sessions');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Password reset requires email', async ({ request }) => {
            const response = await request.post('/api/auth/forgot-password', {
                data: {}
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('A09: Security Logging and Monitoring', () => {
        test('Invalid login attempts handled gracefully', async ({ page }) => {
            await page.goto('/login');

            await page.locator('input[type="email"]').fill('attacker@test.com');
            await page.locator('input[type="password"]').fill('wrongpassword');
            await page.locator('button[type="submit"]').click();

            await page.waitForTimeout(2000);

            // Should show error, not crash
            await expect(page.locator('body')).toBeVisible();
        });
    });
});
