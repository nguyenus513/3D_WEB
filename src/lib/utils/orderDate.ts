type DateLikeRecord = Record<string, unknown>;

const DATE_FIELDS = [
    'created_at',
    'updated_at',
    'confirmed_at',
    'paid_at',
    'processing_at',
    'designing_at',
    'review_at',
    'revising_at',
    'approved_at',
    'producing_at',
    'printing_at',
    'shipped_at',
    'delivered_at',
    'completed_at',
];

export function getObjectIdTimestamp(id?: unknown): string | null {
    if (typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) return null;
    const seconds = Number.parseInt(id.slice(0, 8), 16);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return new Date(seconds * 1000).toISOString();
}

export function getValidDate(value?: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function resolveOrderDate(order?: DateLikeRecord | null, items: DateLikeRecord[] = []): string {
    const candidates: unknown[] = [];
    if (order) {
        for (const field of DATE_FIELDS) candidates.push(order[field]);
        candidates.push(getObjectIdTimestamp(order.id));
    }
    for (const item of items) {
        for (const field of DATE_FIELDS) candidates.push(item[field]);
        candidates.push(getObjectIdTimestamp(item.id));
    }

    for (const candidate of candidates) {
        const date = getValidDate(candidate);
        if (date) return date;
    }

    return new Date().toISOString();
}

export function compareOrderDateDesc(a: DateLikeRecord, b: DateLikeRecord): number {
    return Date.parse(resolveOrderDate(b, Array.isArray(b.items) ? b.items as DateLikeRecord[] : []))
        - Date.parse(resolveOrderDate(a, Array.isArray(a.items) ? a.items as DateLikeRecord[] : []));
}
