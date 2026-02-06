/**
 * Payment Validator Schemas
 *
 * Zod schemas for validating payment-related API inputs.
 */

import { z } from 'zod';

export const CartPaymentItemSchema = z.object({
    productId: z.string().uuid().optional(),
    productName: z.string().min(1),
    productType: z.enum(['product', 'printing', 'custom']),
    productSku: z.string().optional(),
    quantity: z.number().int().min(1).max(100),
    unitPrice: z.number().positive(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export const CartPaymentSchema = z.object({
    items: z.array(CartPaymentItemSchema).min(1),
    shippingAddress: z.object({
        full_name: z.string().min(1).max(100),
        phone: z.string().min(9).max(15),
        address_line: z.string().min(5).max(500),
        ward: z.string().max(100).optional(),
        district: z.string().max(100).optional(),
        province: z.string().min(1).max(100),
    }),
    note: z.string().max(500).optional(),
});

export type CartPaymentInput = z.infer<typeof CartPaymentSchema>;

