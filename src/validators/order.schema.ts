/**
 * Order Validator Schemas
 *
 * Zod schemas for validating order-related API inputs.
 *
 * @see backend-dev-guidelines.md - Rule #5: Validate All Input with Zod
 */

import { z } from 'zod';

// =============================================================================
// Order Status Enum
// =============================================================================

export const OrderStatus = z.enum([
    'pending',
    'paid',
    'confirmed',
    'processing',
    'designing',
    'producing',
    'shipping',
    'delivered',
    'completed',
    'cancelled',
    'refunded',
]);

export type OrderStatusType = z.infer<typeof OrderStatus>;

// =============================================================================
// Order Item Schema
// =============================================================================

export const OrderItemSchema = z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(100),
    price: z.number().positive(),
    customization: z.record(z.string(), z.unknown()).optional(),
});

export type OrderItemInput = z.infer<typeof OrderItemSchema>;

// =============================================================================
// Create Order Schema
// =============================================================================

export const CreateOrderSchema = z.object({
    items: z.array(OrderItemSchema).min(1, 'Order must have at least one item'),
    shipping_address_id: z.string().uuid().optional(),
    shipping_address: z
        .object({
            name: z.string().min(1).max(100),
            phone: z.string().min(10).max(15),
            address: z.string().min(5).max(500),
            city: z.string().min(1).max(100),
            district: z.string().min(1).max(100).optional(),
            postal_code: z.string().max(20).optional(),
        })
        .optional(),
    payment_method: z.enum(['bank_transfer', 'cod', 'momo', 'vnpay']).default('bank_transfer'),
    notes: z.string().max(1000).optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

// =============================================================================
// Update Order Status Schema
// =============================================================================

export const UpdateOrderStatusSchema = z.object({
    status: OrderStatus,
    notes: z.string().max(500).optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;

// =============================================================================
// Query Params Schema
// =============================================================================

export const OrderQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: OrderStatus.optional(),
    from_date: z.coerce.date().optional(),
    to_date: z.coerce.date().optional(),
});

export type OrderQueryInput = z.infer<typeof OrderQuerySchema>;
