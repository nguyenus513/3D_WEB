/**
 * Unit Tests - Transfer Content Utility
 *
 * Tests for VietQR transfer content generation with 25-char validation
 */

import { describe, it, expect } from 'vitest';
import {
    buildTransferContent,
    generateTransferContent,
    VIETQR_MAX_TRANSFER_CONTENT_LENGTH
} from '@/lib/services/paymentConfigService';

describe('buildTransferContent', () => {
    it('should format as {customerCode}_{orderCode}', () => {
        expect(buildTransferContent('1E08D23AA9', '5C3C874218')).toBe('1E08D23AA9_5C3C874218');
    });

    it('should pass with 10-char hex codes (21 total chars)', () => {
        const content = buildTransferContent('ABCDEF1234', '56789ABCDE');
        expect(content.length).toBe(21);
        expect(content).toBe('ABCDEF1234_56789ABCDE');
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
        expect(generateTransferContent('1E08D23AA9', '5C3C874218'))
            .toBe(buildTransferContent('1E08D23AA9', '5C3C874218'));
    });
});

describe('VIETQR_MAX_TRANSFER_CONTENT_LENGTH', () => {
    it('should be 25', () => {
        expect(VIETQR_MAX_TRANSFER_CONTENT_LENGTH).toBe(25);
    });
});
