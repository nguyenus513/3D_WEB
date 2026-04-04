import crypto from 'crypto';
import type { SlicerResult, SliceJobParams, QuoteResult } from './types';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
    result: QuoteResult;
    expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function buildCacheKey(fileBuffer: Buffer, params: SliceJobParams): string {
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex').slice(0, 16);
    const configHash = crypto
        .createHash('sha256')
        .update(
            JSON.stringify({
                profileId: params.profileId,
                mode: params.mode,
                layerHeight: params.layerHeight,
                infill: params.infill,
                support: params.support,
                quantity: params.quantity,
            }),
        )
        .digest('hex')
        .slice(0, 8);
    return `${fileHash}_${configHash}`;
}

export function getCached(key: string): QuoteResult | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }

    const copy = { ...entry.result } as QuoteResult & { source: string };
    copy.source = 'cache';
    return copy as QuoteResult;
}

export function setCached(key: string, result: QuoteResult): void {
    cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    pruneExpired();
}

function pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (now > entry.expiresAt) cache.delete(key);
    }
}
