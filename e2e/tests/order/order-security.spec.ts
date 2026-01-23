import { test, expect } from '@playwright/test';

/**
 * VI. ORDER & CHECKOUT CRITICAL TESTS
 */
test.describe('Order & Checkout - Critical Business Logic', () => {
    test.describe('Price Server-Side Validation', () => {
        test('Server rejects negative price', async ({ request }) => {
            const response = await request.post('/api/orders/create', {
                data: {
                    items: [{
                        id: 'test',
                        name: 'Test',
                        price: -100000,
                        quantity: 1
                    }],
                    total: -100000
                }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Server rejects zero price', async ({ request }) => {
            const response = await request.post('/api/orders/create', {
                data: {
                    items: [{
                        id: 'test',
                        name: 'Test',
                        price: 0,
                        quantity: 1
                    }],
                    total: 0
                }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Server rejects mismatched total', async ({ request }) => {
            const response = await request.post('/api/orders/create', {
                data: {
                    items: [{
                        id: 'test',
                        name: 'Test',
                        price: 1000000,
                        quantity: 10
                    }],
                    total: 1 // Client lies about total
                }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('Order Authentication', () => {
        test('Order creation requires auth', async ({ request }) => {
            const response = await request.post('/api/orders/create', {
                data: { items: [] }
            });
            expect(response.status()).toBe(401);
        });
    });

    test.describe('Quantity Validation', () => {
        test('Rejects negative quantity', async ({ request }) => {
            const response = await request.post('/api/orders/create', {
                data: {
                    items: [{
                        id: 'test',
                        name: 'Test',
                        price: 100000,
                        quantity: -5
                    }]
                }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Rejects zero quantity', async ({ request }) => {
            const response = await request.post('/api/orders/create', {
                data: {
                    items: [{
                        id: 'test',
                        name: 'Test',
                        price: 100000,
                        quantity: 0
                    }]
                }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });
});
