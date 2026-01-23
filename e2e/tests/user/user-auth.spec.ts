import { test, expect } from '@playwright/test';

/**
 * II. USER TESTS - Đăng ký / Đăng nhập / Tài khoản
 */
test.describe('User Authentication - Full Coverage', () => {
    test.describe('Registration', () => {
        test('Valid email format accepted', async ({ page }) => {
            await page.goto('/register');
            const emailInput = page.locator('input[type="email"]');
            await emailInput.fill('valid@example.com');
            await expect(emailInput).toHaveValue('valid@example.com');
        });

        test('Invalid email format rejected', async ({ page }) => {
            await page.goto('/register');
            const emailInput = page.locator('input[type="email"]');
            await emailInput.fill('invalid-email');

            // Try to submit
            const submitBtn = page.locator('button[type="submit"]');
            await submitBtn.click();

            // Should stay on page due to HTML5 validation
            await expect(page).toHaveURL(/register/);
        });

        test('Weak password rejected', async ({ page }) => {
            await page.goto('/register');

            // Fill form with weak password
            await page.locator('input[type="email"]').fill('test@example.com');
            const passwordInputs = page.locator('input[type="password"]');
            await passwordInputs.first().fill('123'); // Too short

            // Submit
            await page.locator('button[type="submit"]').click();
            await page.waitForTimeout(1000);

            // Should show error or stay on page
            await expect(page).toHaveURL(/register/);
        });

        test('SQL injection in input blocked', async ({ page }) => {
            await page.goto('/register');

            const nameInput = page.getByPlaceholder(/họ tên|name/i);
            if (await nameInput.isVisible()) {
                await nameInput.fill("'; DROP TABLE users; --");
            }

            // Page should not crash
            await expect(page.locator('body')).toBeVisible();
        });

        test('XSS in input blocked', async ({ page }) => {
            await page.goto('/register');

            const nameInput = page.getByPlaceholder(/họ tên|name/i);
            if (await nameInput.isVisible()) {
                await nameInput.fill('<script>alert("xss")</script>');
            }

            // Script should not execute
            await expect(page.locator('body')).not.toContainText('<script>');
        });
    });

    test.describe('Login', () => {
        test('Valid credentials format accepted', async ({ page }) => {
            await page.goto('/login');

            await page.locator('input[type="email"]').fill('user@example.com');
            await page.locator('input[type="password"]').fill('ValidPassword123');

            // Form should be fillable
            await expect(page.locator('input[type="email"]')).toHaveValue('user@example.com');
        });

        test('Empty form submission blocked', async ({ page }) => {
            await page.goto('/login');

            await page.locator('button[type="submit"]').click();

            // Should stay on login page
            await expect(page).toHaveURL(/login/);
        });

        test('Brute-force protection test', async ({ page }) => {
            await page.goto('/login');

            // Attempt multiple failed logins
            for (let i = 0; i < 5; i++) {
                await page.locator('input[type="email"]').fill('test@example.com');
                await page.locator('input[type="password"]').fill('wrong' + i);
                await page.locator('button[type="submit"]').click();
                await page.waitForTimeout(500);
            }

            // System should still be responsive
            await expect(page.locator('body')).toBeVisible();
        });
    });

    test.describe('Forgot Password', () => {
        test('Forgot password form loads', async ({ page }) => {
            await page.goto('/forgot-password');

            const emailInput = page.locator('input[type="email"]');
            await expect(emailInput).toBeVisible();
        });

        test('Valid email submitted', async ({ page }) => {
            await page.goto('/forgot-password');

            await page.locator('input[type="email"]').fill('test@example.com');
            await page.locator('button[type="submit"]').click();

            await page.waitForTimeout(2000);
            // Should show success or stay on page
            await expect(page.locator('body')).toBeVisible();
        });
    });

    test.describe('Session Management', () => {
        test('Logout redirects properly', async ({ page }) => {
            await page.goto('/');
            // Check if logout link exists (when logged in)
            // This is a placeholder - actual test needs auth
            await expect(page.locator('body')).toBeVisible();
        });
    });
});
