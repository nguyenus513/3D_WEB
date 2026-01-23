import { test, expect } from '@playwright/test';

/**
 * V. RBAC PERMISSION TESTS
 */
test.describe('RBAC Permission Tests', () => {
    test.describe('User Cannot Access Admin', () => {
        test('User cannot access admin stats', async ({ request }) => {
            const response = await request.get('/api/admin/stats');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('User cannot access admin orders', async ({ request }) => {
            const response = await request.get('/api/admin/orders');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('User cannot access admin products', async ({ request }) => {
            const response = await request.get('/api/admin/products');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('User cannot access admin customers', async ({ request }) => {
            const response = await request.get('/api/admin/customers');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('User cannot access admin revenue', async ({ request }) => {
            const response = await request.get('/api/admin/revenue');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('User cannot access admin categories', async ({ request }) => {
            const response = await request.get('/api/admin/categories');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('Admin Mutations Protected', () => {
        test('Cannot create product without admin auth', async ({ request }) => {
            const response = await request.post('/api/admin/products', {
                data: { name: 'Test', price: 100 }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Cannot update order without admin auth', async ({ request }) => {
            const response = await request.patch('/api/admin/orders/test-id', {
                data: { status: 'delivered' }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Cannot delete product without admin auth', async ({ request }) => {
            const response = await request.delete('/api/admin/products?id=test-id');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('Permission Bypass Prevention', () => {
        test('Cannot bypass with role in body', async ({ request }) => {
            const response = await request.post('/api/admin/products', {
                data: {
                    name: 'Test',
                    price: 100,
                    role: 'admin', // Try to set role
                    isAdmin: true
                }
            });
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });

        test('Cannot bypass with role in query', async ({ request }) => {
            const response = await request.get('/api/admin/stats?role=admin&isAdmin=true');
            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });
});
