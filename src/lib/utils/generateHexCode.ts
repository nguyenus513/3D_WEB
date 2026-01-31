/**
 * Generate a random hex code for order identification
 * @param length - Number of hex characters (default: 12)
 * @returns Uppercase hex string
 */
export function generateHexCode(length: number = 12): string {
    const bytes = new Uint8Array(length / 2);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

