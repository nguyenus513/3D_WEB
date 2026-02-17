/**
 * Deposit Calculation Utility
 * 
 * Business Rules:
 * - 3D Printing: 100% payment required
 * - Ready-made Products: 100% payment required
 * - Custom Orders: 50% deposit required
 * - Mixed Orders: 50% of custom items + 100% of print/product items
 */

export type OrderType = 'printing' | 'print' | 'print_3d' | 'ready_made' | 'product' | 'custom' | 'mixed';

export interface OrderItem {
    item_type?: string;
    total_price?: number;
    unit_price?: number;
    quantity?: number;
}

/**
 * Calculate deposit amount based on order type
 * @param totalAmount - Total order amount
 * @param orderType - Type of order
 * @returns Deposit amount required
 */
export function calculateDeposit(totalAmount: number, orderType: OrderType | string): number {
    // Custom orders: 50% deposit
    if (orderType === 'custom') {
        return Math.round(totalAmount * 0.5);
    }

    // 3D Printing: 100% payment
    if (orderType === 'printing' || orderType === 'print' || orderType === 'print_3d') {
        return totalAmount;
    }

    // Ready-made products: 100% payment
    if (orderType === 'ready_made' || orderType === 'product') {
        return totalAmount;
    }

    // Mixed orders WITHOUT items breakdown: fallback to weighted average
    // This should ideally use calculateMixedDeposit() with items
    if (orderType === 'mixed') {
        // Fallback - assume 50% of order is custom
        return Math.round(totalAmount * 0.75); // 50% custom (0.5*0.5) + 50% other (0.5*1.0)
    }

    // Default: 100% for unknown types (safer default)
    return totalAmount;
}

/**
 * Calculate deposit for mixed orders based on individual items
 * Rules:
 * - Custom items: 50% deposit
 * - Print/Product items: 100% payment
 * 
 * @param items - Array of order items with item_type and price
 * @returns Deposit amount required
 */
export function calculateMixedDeposit(items: OrderItem[]): number {
    let depositTotal = 0;

    for (const item of items) {
        const itemPrice = item.total_price || (item.unit_price || 0) * (item.quantity || 1);
        const itemType = item.item_type || 'ready_made';

        if (itemType === 'custom') {
            // Custom: 50% deposit
            depositTotal += Math.round(itemPrice * 0.5);
        } else {
            // Print, product, ready_made: 100% payment
            depositTotal += itemPrice;
        }
    }

    return depositTotal;
}

/**
 * Get deposit percentage for display (simple orders only)
 * @param orderType - Type of order
 * @returns Percentage as number (0.5 or 1)
 */
export function getDepositPercentage(orderType: OrderType | string): number {
    if (orderType === 'custom') {
        return 0.5;
    }
    return 1;
}

/**
 * Get deposit label for display
 * @param orderType - Type of order
 * @returns Display label string
 */
export function getDepositLabel(orderType: OrderType | string): string {
    if (orderType === 'custom') {
        return 'Đặt cọc 50%';
    }
    if (orderType === 'mixed') {
        return 'Custom 50% + Còn lại 100%';
    }
    return 'Thanh toán 100%';
}

/**
 * Check if order requires full payment (100%)
 * @param orderType - Type of order
 * @returns true if 100% payment required
 */
export function requiresFullPayment(orderType: OrderType | string): boolean {
    return orderType !== 'custom' && orderType !== 'mixed';
}

/**
 * Determine order type based on items
 * @param items - Array of order items
 * @returns Order type
 */
export function determineOrderType(items: OrderItem[]): OrderType {
    const types = new Set(items.map(item => item.item_type || 'ready_made'));

    if (types.size > 1) return 'mixed';

    const singleType = Array.from(types)[0];
    if (singleType === 'custom') return 'custom';
    if (singleType === 'printing' || singleType === 'print' || singleType === 'print_3d') return 'printing';
    return 'ready_made';
}
