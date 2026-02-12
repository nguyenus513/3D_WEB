/**
 * TOTP (Time-based One-Time Password) Service
 *
 * Provides 2FA functionality using authenticator apps (Google Authenticator, Authy).
 * Uses the otpauth library for TOTP generation and verification.
 */

import { TOTP, Secret } from 'otpauth';
import crypto from 'crypto';

const ISSUER = 'Miniver 3D LAB';
const ALGORITHM = 'SHA1';
const DIGITS = 6;
const PERIOD = 30; // seconds

/**
 * Generate a new TOTP secret and provisioning URI
 */
export function generateSecret(accountName: string): {
    secret: string;
    uri: string;
} {
    const secret = new Secret({ size: 20 });

    const totp = new TOTP({
        issuer: ISSUER,
        label: accountName,
        algorithm: ALGORITHM,
        digits: DIGITS,
        period: PERIOD,
        secret,
    });

    return {
        secret: secret.base32,
        uri: totp.toString(),
    };
}

/**
 * Verify a TOTP token against a secret
 * Allows a window of ±1 period (±30 seconds) for clock drift
 */
export function verifyToken(secret: string, token: string): boolean {
    const totp = new TOTP({
        issuer: ISSUER,
        algorithm: ALGORITHM,
        digits: DIGITS,
        period: PERIOD,
        secret: Secret.fromBase32(secret),
    });

    // validate returns the time step difference, or null if invalid
    // window: 1 means ±1 period (allows 30 seconds clock drift)
    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
}

/**
 * Generate recovery codes (8 codes, 10 characters each)
 * Returns both plain codes (to show user) and hashed codes (to store)
 */
export function generateRecoveryCodes(): {
    plainCodes: string[];
    hashedCodes: string[];
} {
    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < 8; i++) {
        // Generate 10-character alphanumeric code
        const code = crypto.randomBytes(5).toString('hex').toUpperCase();
        // Format: XXXXX-XXXXX for readability
        const formatted = `${code.slice(0, 5)}-${code.slice(5)}`;
        plainCodes.push(formatted);
        hashedCodes.push(hashRecoveryCode(formatted));
    }

    return { plainCodes, hashedCodes };
}

/**
 * Verify a recovery code against stored hashed codes
 * Returns the updated codes array with the used code removed, or null if invalid
 */
export function verifyRecoveryCode(
    hashedCodes: string[],
    inputCode: string
): string[] | null {
    const inputHash = hashRecoveryCode(inputCode.trim().toUpperCase());

    const index = hashedCodes.findIndex(stored => stored === inputHash);
    if (index === -1) return null;

    // Remove used code
    const updatedCodes = [...hashedCodes];
    updatedCodes.splice(index, 1);
    return updatedCodes;
}

/**
 * Hash a recovery code using SHA-256
 */
function hashRecoveryCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Generate a QR code data URL from a TOTP URI
 */
export async function generateQRCodeDataURL(uri: string): Promise<string> {
    const QRCode = await import('qrcode');
    return QRCode.toDataURL(uri, {
        width: 256,
        margin: 2,
        color: {
            dark: '#1d1d1f',
            light: '#ffffff',
        },
    });
}
