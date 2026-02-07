/**
 * Unit Tests - Transfer Content Utility
 *
 * Tests for VietQR transfer content generation with 25-char validation
 * Format: {cartCode}_{orderCode} = 8 + 1 + 8 = 17 chars
 */

import { describe, it, expect } from 'vitest';
import {
    buildTransferContent,
    generateTransferContent,
    VIETQR_MAX_TRANSFER_CONTENT_LENGTH
} from '@/lib/services/paymentConfigService';

describe('buildTransferContent', () => {
    it('should format as {cartCode}_{orderCode}', () => {
        expect(buildTransferContent('1E08D23A', '5C3C8742')).toBe('1E08D23A_5C3C8742');
    });

    it('should pass with 8-char hex codes (17 total chars)', () => {
        const content = buildTransferContent('ABCDEF12', '56789ABC');
        expect(content.length).toBe(17);
        expect(content).toBe('ABCDEF12_56789ABC');
    });

    it('should allow content up to 25 chars', () => {
        // 12 + 1 + 12 = 25 chars (exactly at limit)
        const content = buildTransferContent('ABCDEF123456', 'FEDCBA654321');
        expect(content.length).toBe(25);
    });

    it('should throw if content exceeds 25 chars', () => {
        // 13 + 1 + 13 = 27 chars (over limit)
        expect(() => buildTransferContent('TOOLONGCODE13', 'ANOTHERLONGC13')).toThrow();
    });

    it('should include helpful error message when throwing', () => {
        expect(() => buildTransferContent('TOOLONGCODE13', 'ANOTHERLONGC13'))
            .toThrow(/exceeds VietQR limit/);
    });

    it('should handle empty strings (edge case)', () => {
        expect(buildTransferContent('', '')).toBe('_');
    });

    it('should work with shorter codes', () => {
        const content = buildTransferContent('ABC', '123');
        expect(content).toBe('ABC_123');
        expect(content.length).toBe(7);
    });
});

describe('generateTransferContent (deprecated)', () => {
    it('should work as alias for buildTransferContent', () => {
        expect(generateTransferContent('1E08D23A', '5C3C8742'))
            .toBe(buildTransferContent('1E08D23A', '5C3C8742'));
    });
});

describe('VIETQR_MAX_TRANSFER_CONTENT_LENGTH', () => {
    it('should be 25', () => {
        expect(VIETQR_MAX_TRANSFER_CONTENT_LENGTH).toBe(25);
    });
});
