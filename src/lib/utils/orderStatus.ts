/**
 * Order Status Utilities
 * 
 * Chuẩn hóa trạng thái đơn hàng theo production standards
 * - Không icon, không emoji
 * - Tiếng Việt thuần
 * - Cart: 4 bước cố định
 * - Item: chi tiết hơn, phụ thuộc cart
 */

// ═══════════════════════════════════════════════════════════════
// CART STATUS (4 bước cố định)
// ═══════════════════════════════════════════════════════════════
export type CartStatus = 'confirmed' | 'processing' | 'shipping' | 'completed';

export const CART_STATUS_LABELS: Record<CartStatus, string> = {
    confirmed: 'Đã xác nhận',
    processing: 'Đang xử lý',
    shipping: 'Đang giao hàng',
    completed: 'Hoàn thành',
};

// Mapping từ các giá trị cũ sang chuẩn mới
export function normalizeCartStatus(status: string): CartStatus {
    const mapping: Record<string, CartStatus> = {
        'pending': 'confirmed',
        'confirmed': 'confirmed',
        'paid': 'confirmed',
        'processing': 'processing',
        'producing': 'processing',
        'shipping': 'shipping',
        'delivered': 'completed',
        'completed': 'completed',
        'done': 'completed',
    };
    return mapping[status] || 'confirmed';
}

// ═══════════════════════════════════════════════════════════════
// ITEM STATUS (chi tiết, phụ thuộc cart status)
// ═══════════════════════════════════════════════════════════════
export type ItemStatus =
    | 'waiting'
    | 'designing'
    | 'waiting_approval'
    | 'producing'
    | 'ready_to_ship'
    | 'shipping'
    | 'delivered'
    | 'completed';

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
    waiting: 'Đang xử lý',
    designing: 'Đang thiết kế',
    waiting_approval: 'Chờ xác nhận thiết kế',
    producing: 'Đang sản xuất',
    ready_to_ship: 'Sẵn sàng giao',
    shipping: 'Đang giao hàng',
    delivered: 'Đã giao',
    completed: 'Hoàn thành',
};

// Mapping từ các giá trị cũ sang chuẩn mới
export function normalizeItemStatus(status: string): ItemStatus {
    const mapping: Record<string, ItemStatus> = {
        'waiting': 'waiting',
        'pending': 'waiting',
        'designing': 'designing',
        'waiting_approval': 'waiting_approval',
        'preview_pending': 'waiting_approval',
        'producing': 'producing',
        'printing': 'producing',
        'ready_to_ship': 'ready_to_ship',
        'ready': 'ready_to_ship',
        'shipping': 'shipping',
        'delivered': 'delivered',
        'completed': 'completed',
        'done': 'completed',
    };
    return mapping[status] || 'waiting';
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get cart status label (Vietnamese, no icon)
 */
export function getCartStatusLabel(status: string): string {
    const normalized = normalizeCartStatus(status);
    return CART_STATUS_LABELS[normalized];
}

/**
 * Get item status label (Vietnamese, no icon)
 */
export function getItemStatusLabel(status: string): string {
    const normalized = normalizeItemStatus(status);
    return ITEM_STATUS_LABELS[normalized];
}

/**
 * Format date: DD/MM/YYYY HH:MM:SS
 */
export function formatOrderDate(dateString: string): string {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Get timeline steps for cart (4 fixed steps)
 */
export function getCartTimeline(currentStatus: string, createdAt?: string) {
    const normalized = normalizeCartStatus(currentStatus);
    const statuses: CartStatus[] = ['confirmed', 'processing', 'shipping', 'completed'];
    const currentIndex = statuses.indexOf(normalized);

    return statuses.map((status, index) => ({
        status,
        label: CART_STATUS_LABELS[status],
        completed: index <= currentIndex,
        date: index === 0 && createdAt ? formatOrderDate(createdAt) : undefined,
    }));
}

/**
 * Validate item status is allowed for given cart status
 */
export function isItemStatusValid(cartStatus: string, itemStatus: string): boolean {
    const cart = normalizeCartStatus(cartStatus);
    const item = normalizeItemStatus(itemStatus);

    const validMapping: Record<CartStatus, ItemStatus[]> = {
        confirmed: ['waiting'],
        processing: ['designing', 'waiting_approval', 'producing', 'ready_to_ship'],
        shipping: ['shipping'],
        completed: ['delivered', 'completed'],
    };

    return validMapping[cart]?.includes(item) ?? false;
}

// ═══════════════════════════════════════════════════════════════
// SHIPPING PROVIDERS
// ═══════════════════════════════════════════════════════════════
export const SHIPPING_PROVIDERS = {
    GHN: 'Giao Hàng Nhanh',
    GHTK: 'Giao Hàng Tiết Kiệm',
    VNPost: 'Vietnam Post',
    JT: 'J&T Express',
    Viettel: 'Viettel Post',
} as const;

export type ShippingProvider = keyof typeof SHIPPING_PROVIDERS;

/**
 * Format tracking display
 */
export function formatTrackingInfo(provider: string, trackingCode: string): string {
    const providerName = SHIPPING_PROVIDERS[provider as ShippingProvider] || provider;
    return `${providerName}: ${trackingCode}`;
}
