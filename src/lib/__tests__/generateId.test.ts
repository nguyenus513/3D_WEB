/**
 * Unit Tests - generateId Utility
 *
 * Tests for ID generation functions
 */

import { describe, it, expect } from 'vitest';
import { generateId, validateId, getOrderTypeFromId } from '@/lib/generateId';

describe('generateId', () => {
    describe('order()', () => {
        it('should generate order ID with PDC prefix', () => {
            const id = generateId.order();
            expect(id).toMatch(/^PDC-[0-9A-HJ-NP-Z]{8}$/);
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
        it('should generate user ID with USR prefix', () => {
            const id = generateId.user();
            expect(id).toMatch(/^USR-[0-9A-HJ-NP-Z]{8}$/);
        });
    });

    describe('product()', () => {
        it('should generate product ID with PDC prefix', () => {
            const id = generateId.product();
            expect(id).toMatch(/^PDC-[0-9A-HJ-NP-Z]{8}$/);
        });
    });

    describe('custom()', () => {
        it('should generate custom order ID with CUS prefix', () => {
            const id = generateId.custom();
            expect(id).toMatch(/^CUS-[0-9A-HJ-NP-Z]{8}$/);
        });
    });

    describe('printing()', () => {
        it('should generate 3D printing ID with 3DP prefix', () => {
            const id = generateId.printing();
            expect(id).toMatch(/^3DP-[0-9A-HJ-NP-Z]{8}$/);
        });
    });

    describe('sku()', () => {
        it('should generate SKU with PRD prefix', () => {
            const id = generateId.sku();
            expect(id).toMatch(/^PRD-[0-9A-HJ-NP-Z]{8}$/);
        });
    });

    describe('raw()', () => {
        it('should generate 8-character code without prefix', () => {
            const id = generateId.raw();
            expect(id).toMatch(/^[0-9A-HJ-NP-Z]{8}$/);
        });
    });
});

describe('validateId', () => {
    it('should validate custom order ID', () => {
        expect(validateId.custom('CUS-A7K3M9B2')).toBe(true);
        expect(validateId.custom('PDC-A7K3M9B2')).toBe(false);
    });

    it('should validate product ID', () => {
        expect(validateId.product('PDC-B2N8P4K5')).toBe(true);
        expect(validateId.product('CUS-B2N8P4K5')).toBe(false);
    });

    it('should validate any valid ID format', () => {
        expect(validateId.any('USR-K5J2H8M4')).toBe(true);
        expect(validateId.any('3DP-M4R7S2N9')).toBe(true);
        expect(validateId.any('invalid')).toBe(false);
    });
});

describe('getOrderTypeFromId', () => {
    it('should return correct order type from ID prefix', () => {
        expect(getOrderTypeFromId('CUS-A7K3M9B2')).toBe('custom');
        expect(getOrderTypeFromId('PDC-B2N8P4K5')).toBe('product');
        expect(getOrderTypeFromId('3DP-M4R7S2N9')).toBe('printing');
        expect(getOrderTypeFromId('XXX-12345678')).toBe('unknown');
    });
});
