import { test, expect } from '@playwright/test';

/**
 * IV. JWT & AUTH TOKEN TESTS
 */
test.describe('JWT & Authentication Security', () => {
    test.describe('Token Validation', () => {
        test('Fake JWT rejected', async ({ request }) => {
            const response = await request.get('/api/wishlist', {
                headers: {
                    'Authorization': 'Bearer fake.jwt.token'
                }
            });
            expect(response.status()).toBe(401);
        });

        test('Malformed JWT rejected', async ({ request }) => {
            const response = await request.get('/api/wishlist', {
                headers: {
                    'Authorization': 'Bearer not-a-valid-jwt'
                }
            });
            expect(response.status()).toBe(401);
        });

        test('Missing authorization header', async ({ request }) => {
            const response = await request.get('/api/wishlist');
            expect(response.status()).toBe(401);
        });

        test('Empty authorization header', async ({ request }) => {
            const response = await request.get('/api/wishlist', {
                headers: {
                    'Authorization': ''
                }
            });
            expect(response.status()).toBe(401);
        });
    });

    test.describe('Session Endpoints', () => {
        test('Sessions endpoint requires auth', async ({ request }) => {
            const response = await request.get('/api/auth/sessions');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Refresh endpoint handles invalid token', async ({ request }) => {
            const response = await request.post('/api/auth/refresh', {
                data: { refreshToken: 'invalid-token' }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });
});
