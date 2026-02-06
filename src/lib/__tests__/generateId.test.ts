/**
 * Unit Tests - generateId Utility
 *
 * Tests for ID generation functions
 */

import { describe, it, expect } from 'vitest';
import { generateId, validateId, getOrderTypeFromId } from '@/lib/generateId';

describe('generateId', () => {
    describe('order()', () => {
        it('should generate order ID with hex format', () => {
            const id = generateId.order();
            expect(id).toMatch(/^[0-9A-F]{10}$/);
        });

        it('should generate unique IDs', () => {
            const ids = new Set();
            for (let i = 0; i < 100; i++) {
                ids.add(generateId.order());
            }
            expect(ids.size).toBe(100);
        });
    });

    describe('user()', () => {
        it('should generate user ID with hex format', () => {
            const id = generateId.user();
            expect(id).toMatch(/^[0-9A-F]{10}$/);
        });
    });

    describe('product()', () => {
        it('should generate product ID with hex format', () => {
            const id = generateId.product();
            expect(id).toMatch(/^[0-9A-F]{10}$/);
        });
    });

    describe('custom()', () => {
        it('should generate custom order ID with hex format', () => {
            const id = generateId.custom();
            expect(id).toMatch(/^[0-9A-F]{10}$/);
        });
    });

    describe('printing()', () => {
        it('should generate 3D printing ID with hex format', () => {
            const id = generateId.printing();
            expect(id).toMatch(/^[0-9A-F]{10}$/);
        });
    });

    describe('sku()', () => {
        it('should generate SKU with hex format', () => {
            const id = generateId.sku();
            expect(id).toMatch(/^[0-9A-F]{8}$/);
        });
    });

    describe('raw()', () => {
        it('should generate 8-character hex code when length provided', () => {
            const id = generateId.raw(8);
            expect(id).toMatch(/^[0-9A-F]{8}$/);
        });
    });
});

describe('validateId', () => {
    it('should validate custom order ID', () => {
        expect(validateId.custom('A7B3C9D1E2')).toBe(true);
        expect(validateId.custom('CUS-A7K3M9B2')).toBe(false);
    });

    it('should validate product ID', () => {
        expect(validateId.product('B2C8D4E5F6')).toBe(true);
        expect(validateId.product('PDC-B2N8P4K5')).toBe(false);
    });

    it('should validate any valid ID format', () => {
        expect(validateId.any('A1B2C3D4E5')).toBe(true);
        expect(validateId.any('F1E2D3C4B5')).toBe(true);
        expect(validateId.any('invalid')).toBe(false);
    });
});

describe('getOrderTypeFromId', () => {
    it('should return master for 12-char hex and unknown for 10-char hex', () => {
        expect(getOrderTypeFromId('A1B2C3D4E5F6')).toBe('master');
        expect(getOrderTypeFromId('A7B3C9D1E2')).toBe('unknown');
    });
});
