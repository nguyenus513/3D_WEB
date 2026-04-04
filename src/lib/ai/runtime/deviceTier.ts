export type DeviceTier = 'high' | 'mid' | 'low';

/**
 * `deviceMemory` is a W3C Memory Hints API property (widely supported).
 * Declared via an ambient interface so we avoid casting `navigator` to `any`.
 */
interface NavigatorMemory {
    readonly deviceMemory?: number;
}

let cachedTier: DeviceTier | null = null;

export function getDeviceTier(): DeviceTier {
    if (cachedTier) return cachedTier;

    if (typeof navigator === 'undefined') {
        cachedTier = 'mid';
        return cachedTier;
    }

    const cores = navigator.hardwareConcurrency ?? 2;
    const memory = (navigator as unknown as NavigatorMemory).deviceMemory ?? 2;
    const isWebGPU = 'gpu' in navigator;

    if (isWebGPU && cores >= 8 && memory >= 8) {
        cachedTier = 'high';
    } else if (cores >= 4 || memory >= 4) {
        cachedTier = 'mid';
    } else {
        cachedTier = 'low';
    }

    return cachedTier;
}

export function shouldUseLazyInference(): boolean {
    return getDeviceTier() === 'low';
}
