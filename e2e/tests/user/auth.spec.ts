import { test, expect } from '@playwright/test';

/**
 * Authentication Tests
 */
test.describe('Authentication', () => {
    test.describe('Login Page', () => {
        test('should load login page', async ({ page }) => {
            await page.goto('/login');

            // Login form should be visible
            const emailInput = page.getByPlaceholder(/email/i);
            await expect(emailInput).toBeVisible();

            const passwordInput = page.getByPlaceholder(/mật khẩu|password/i);
            await expect(passwordInput).toBeVisible();
        });

        test('should have forgot password link', async ({ page }) => {
            await page.goto('/login');

            const forgotLink = page.getByRole('link', { name: /quên mật khẩu/i });
            await expect(forgotLink).toBeVisible();
        });

        test('should have register link', async ({ page }) => {
            await page.goto('/login');

            const registerLink = page.getByRole('link', { name: /đăng ký/i });
            await expect(registerLink).toBeVisible();
        });

        test('should show error for invalid credentials', async ({ page }) => {
            await page.goto('/login');

            // Fill invalid credentials
            await page.getByPlaceholder(/email/i).fill('invalid@test.com');
            await page.getByPlaceholder(/mật khẩu|password/i).fill('wrongpassword');

            // Submit form
            await page.getByRole('button', { name: /đăng nhập/i }).click();

            // Wait for error message
            await page.waitForTimeout(2000);

            // Error should be visible
            const errorMessage = page.locator('text=/không đúng|thất bại|error/i');
            await expect(errorMessage).toBeVisible();
        });
    });

    test.describe('Register Page', () => {
        test('should load register page', async ({ page }) => {
            await page.goto('/register');

            // Register form should be visible
            const nameInput = page.getByPlaceholder(/họ tên|name/i);
            await expect(nameInput).toBeVisible();
        });

        test('should have login link', async ({ page }) => {
            await page.goto('/register');

            const loginLink = page.getByRole('link', { name: /đăng nhập/i });
            await expect(loginLink).toBeVisible();
        });
    });

    test.describe('Forgot Password', () => {
        test('should load forgot password page', async ({ page }) => {
            await page.goto('/forgot-password');

            // Email input should be visible
            const emailInput = page.locator('input[type="email"]');
            await expect(emailInput).toBeVisible();

            // Submit button should be visible
            const submitBtn = page.getByRole('button', { name: /gửi/i });
            await expect(submitBtn).toBeVisible();
        });
    });
});
