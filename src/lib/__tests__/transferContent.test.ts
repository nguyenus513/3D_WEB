/**
 * Unit Tests - Transfer Content Utility
 *
 * Tests for VietQR transfer content generation
 * Format: {cart_code} only (8 chars max for new orders)
 */

import { describe, it, expect } from 'vitest';
import {
    buildTransferContent,
    generateTransferContent,
    VIETQR_MAX_TRANSFER_CONTENT_LENGTH
} from '@/lib/services/paymentConfigService';

describe('buildTransferContent', () => {
    it('should return cart_code directly', () => {
        expect(buildTransferContent('1E08D23A')).toBe('1E08D23A');
    });

    it('should work with 8-char hex codes', () => {
        const content = buildTransferContent('ABCDEF12');
        expect(content.length).toBe(8);
        expect(content).toBe('ABCDEF12');
    });

    it('should allow content up to 25 chars', () => {
        // 25 chars exactly at limit (edge case for legacy)
        const content = buildTransferContent('ABCDEFGHIJ1234567890ABCDE');
        expect(content.length).toBe(25);
    });

    it('should throw if content exceeds 25 chars', () => {
        // 26 chars (over limit)
        expect(() => buildTransferContent('ABCDEFGHIJ1234567890ABCDEF')).toThrow();
    });

    it('should include helpful error message when throwing', () => {
        expect(() => buildTransferContent('TOOLONGCODE_EXCEEDS_LIMIT_26'))
            .toThrow(/exceeds VietQR limit/);
    });

    it('should handle empty string (edge case)', () => {
        expect(buildTransferContent('')).toBe('');
    });

    it('should work with shorter codes', () => {
        const content = buildTransferContent('ABC');
        expect(content).toBe('ABC');
        expect(content.length).toBe(3);
    });
});

describe('generateTransferContent (deprecated)', () => {
    it('should work as alias for buildTransferContent', () => {
        expect(generateTransferContent('1E08D23A'))
            .toBe(buildTransferContent('1E08D23A'));
    });
});

describe('VIETQR_MAX_TRANSFER_CONTENT_LENGTH', () => {
    it('should be 25', () => {
        expect(VIETQR_MAX_TRANSFER_CONTENT_LENGTH).toBe(25);
    });
});
