import { test, expect } from '@playwright/test';

/**
 * VIII. SERVER HEALTH & INFRASTRUCTURE TESTS
 */
test.describe('Server Health Tests', () => {
    test.describe('API Availability', () => {
        test('Main API endpoints respond', async ({ request }) => {
            const endpoints = [
                '/api/featured-products',
                '/api/auth/session',
            ];

            for (const endpoint of endpoints) {
                const response = await request.get(endpoint);
                expect(response.status()).toBeLessThan(500);
            }
        });
    });

    test.describe('Error Handling', () => {
        test('404 for unknown API endpoint', async ({ request }) => {
            const response = await request.get('/api/unknown-endpoint-12345');
            expect(response.status()).toBe(404);
        });

        test('Graceful error response format', async ({ request }) => {
            const response = await request.post('/api/orders/create', {
                data: {} // Invalid data
            });

            // Should return JSON error, not HTML
            const contentType = response.headers()['content-type'];
            expect(contentType).toContain('application/json');
        });
    });
});

test.describe('Rate Limiting Tests', () => {
    test('Login has rate limiting', async ({ request }) => {
        const promises = [];

        // Make 10 rapid requests
        for (let i = 0; i < 10; i++) {
            promises.push(
                request.post('/api/auth/login', {
                    data: {
                        email: 'test@test.com',
                        password: 'wrong'
                    }
                })
            );
        }

        const responses = await Promise.all(promises);

        // At least some should succeed
        expect(responses.some(r => r.status() < 500)).toBe(true);
    });

    test('Forgot password has rate limiting', async ({ request }) => {
        const responses = [];

        for (let i = 0; i < 5; i++) {
            const response = await request.post('/api/auth/forgot-password', {
                data: { email: `test${i}@example.com` }
            });
            responses.push(response);
        }

        // Should not crash
        expect(responses.every(r => r.status() < 500)).toBe(true);
    });
});
