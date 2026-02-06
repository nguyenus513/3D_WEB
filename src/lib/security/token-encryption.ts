/**
 * Token Encryption Utility
 * 
 * Encrypts sensitive tokens before storing in database.
 * Uses AES-256-GCM for authenticated encryption.
 * 
 * IMPORTANT: Set TOKEN_ENCRYPTION_KEY env var (32 bytes, hex-encoded = 64 chars)
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 * Falls back to no encryption if not configured (with warning)
 */
function getEncryptionKey(): Buffer | null {
    const keyHex = process.env.TOKEN_ENCRYPTION_KEY;

    if (!keyHex || keyHex.length !== 64) {
        // Key should be 32 bytes = 64 hex chars
        console.warn('[Security] TOKEN_ENCRYPTION_KEY not configured. Tokens stored in plaintext.');
        return null;
    }

    return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt a string value
 * Returns base64-encoded ciphertext with IV and auth tag
 */
export function encryptToken(plaintext: string): string {
    const key = getEncryptionKey();

    if (!key) {
        // No encryption key configured, return plaintext with marker
        return `plain:${plaintext}`;
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Format: iv + authTag + ciphertext (all base64)
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return `enc:${combined.toString('base64')}`;
}

/**
 * Decrypt a string value
 * Expects base64-encoded ciphertext with IV and auth tag
 */
export function decryptToken(ciphertext: string): string {
    // Check if plaintext (not encrypted)
    if (ciphertext.startsWith('plain:')) {
        return ciphertext.slice(6);
    }

    // Check if encrypted
    if (!ciphertext.startsWith('enc:')) {
        // Legacy unencrypted token, return as-is
        return ciphertext;
    }

    const key = getEncryptionKey();

    if (!key) {
        // Key not configured but token is encrypted - this is an error
        throw new Error('TOKEN_ENCRYPTION_KEY required to decrypt tokens');
    }

    const data = ciphertext.slice(4); // Remove 'enc:' prefix
    const combined = Buffer.from(data, 'base64');

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
}

/**
 * Encrypt an object containing token fields
 */
export function encryptTokenData(data: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
}): {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
} {
    return {
        access_token: data.access_token ? encryptToken(data.access_token) : null,
        refresh_token: data.refresh_token ? encryptToken(data.refresh_token) : null,
        expiry_date: data.expiry_date,
    };
}

/**
 * Decrypt an object containing encrypted token fields
 */
export function decryptTokenData(data: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
}): {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
} {
    return {
        access_token: data.access_token ? decryptToken(data.access_token) : null,
        refresh_token: data.refresh_token ? decryptToken(data.refresh_token) : null,
        expiry_date: data.expiry_date,
    };
}
