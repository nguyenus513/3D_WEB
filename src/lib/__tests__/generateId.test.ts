/**
 * Unit Tests - generateId Utility
 *
 * Tests for ID generation functions (8-HEX format)
 */

import { describe, it, expect } from 'vitest';
import { generateId, validateId, getOrderTypeFromId } from '@/lib/generateId';

describe('generateId', () => {
    describe('order()', () => {
        it('should generate order ID as 8-char HEX', () => {
            const id = generateId.order();
            expect(id).toMatch(/^[0-9A-F]{8}$/);
        });

        it('should generate unique IDs', () => {
            const ids = new Set();
            for (let i = 0; i < 100; i++) {
                ids.add(generateId.order());
            }
            expect(ids.size).toBe(100);
        });
    });

    describe('cart()', () => {
        it('should generate cart code as 8-char HEX', () => {
            const id = generateId.cart();
            expect(id).toMatch(/^[0-9A-F]{8}$/);
        });
    });

    describe('user()', () => {
        it('should generate user ID as 10-char HEX', () => {
            const id = generateId.user();
            expect(id).toMatch(/^[0-9A-F]{10}$/);
        });
    });

    describe('product()', () => {
        it('should generate product ID as 10-char HEX', () => {
            const id = generateId.product();
            expect(id).toMatch(/^[0-9A-F]{10}$/);
        });
    });

    describe('custom()', () => {
        it('should generate custom order ID as 10-char HEX', () => {
            const id = generateId.custom();
            expect(id).toMatch(/^[0-9A-F]{10}$/);
        });
    });

    describe('printing()', () => {
        it('should generate 3D printing ID as 10-char HEX', () => {
            const id = generateId.printing();
            expect(id).toMatch(/^[0-9A-F]{10}$/);
        });
    });

    describe('sku()', () => {
        it('should generate SKU as 8-char HEX', () => {
            const id = generateId.sku();
            expect(id).toMatch(/^[0-9A-F]{8}$/);
        });
    });

    describe('master()', () => {
        it('should generate master order ID as 12-char HEX', () => {
            const id = generateId.master();
            expect(id).toMatch(/^[0-9A-F]{12}$/);
        });
    });

    describe('raw()', () => {
        it('should generate default 10-character HEX code', () => {
            const id = generateId.raw();
            expect(id).toMatch(/^[0-9A-F]{10}$/);
        });

        it('should generate code with custom length', () => {
            const id = generateId.raw(6);
            expect(id).toMatch(/^[0-9A-F]{6}$/);
        });
    });
});

describe('validateId', () => {
    it('should validate 10-char HEX IDs (custom, product, printing, user)', () => {
        expect(validateId.custom('A7B3C9D2EF')).toBe(true);
        expect(validateId.custom('A7B3C9D2')).toBe(false);  // Too short
        expect(validateId.product('B2C8D4E5FA')).toBe(true);
        expect(validateId.printing('C3D4E5F6AB')).toBe(true);
        expect(validateId.user('D4E5F6A7BC')).toBe(true);
    });

    it('should validate 8-char HEX IDs (sku, cart, order)', () => {
        expect(validateId.sku('A7B3C9D1')).toBe(true);
        expect(validateId.cart('1E08D23A')).toBe(true);
        expect(validateId.order('5C3C8742')).toBe(true);
        expect(validateId.order('5C3C874')).toBe(false);  // Too short
    });

    it('should validate 12-char HEX IDs (master)', () => {
        expect(validateId.master('A1B2C3D4E5F6')).toBe(true);
        expect(validateId.master('A1B2C3D4E5')).toBe(false);  // Too short
    });

    it('should validate any HEX format', () => {
        expect(validateId.any('ABCD1234')).toBe(true);
        expect(validateId.any('abcd1234')).toBe(false);  // Lowercase not valid
        expect(validateId.any('GHIJ1234')).toBe(false);  // Invalid hex chars
    });
});

describe('getOrderTypeFromId', () => {
    it('should return master for 12-char IDs', () => {
        expect(getOrderTypeFromId('A1B2C3D4E5F6')).toBe('master');
    });

    it('should return unknown for other lengths (pure hex has no type prefix)', () => {
        expect(getOrderTypeFromId('A7K3M9B2CD')).toBe('unknown');
        expect(getOrderTypeFromId('A7K3M9B2')).toBe('unknown');
    });
});
