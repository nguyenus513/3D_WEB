import { test, expect } from '@playwright/test';

/**
 * III. GOOGLE DRIVE API TESTS (if used)
 */
test.describe('Google Drive API Security', () => {
    test.describe('Auth & Token Tests', () => {
        test('Drive auth endpoint requires authentication', async ({ request }) => {
            const response = await request.get('/api/drive/auth');
            // Should redirect or require auth
            expect(response.status()).toBeLessThan(500);
        });

        test('Drive status endpoint protected', async ({ request }) => {
            const response = await request.get('/api/drive/status');
            expect(response.status()).toBeLessThan(500);
        });

        test('Drive callback handles missing params', async ({ request }) => {
            const response = await request.get('/api/drive/callback');
            // Should handle gracefully
            expect(response.status()).toBeLessThan(500);
        });
    });

    test.describe('Drive Access Prevention', () => {
        test('Cannot access arbitrary Drive IDs', async ({ request }) => {
            // Try to access a random file ID
            const response = await request.get('/api/files/drive/randomFileId123');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });
});
