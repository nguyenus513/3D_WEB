import { z } from 'zod';

/**
 * Checkout Form Validation Schemas
 * Using Zod for type-safe validation
 */

// Phone regex for Vietnamese phone numbers
const phoneRegex = /^(0|\+84)(3[2-9]|5[6|8|9]|7[0|6-9]|8[1-5]|9[0-9])[0-9]{7}$/;

/**
 * Address Schema
 */
export const addressSchema = z.object({
    label: z.enum(['Nhà', 'Văn phòng', 'Khác']).default('Nhà'),
    full_name: z
        .string()
        .min(2, 'Họ tên phải có ít nhất 2 ký tự')
        .max(100, 'Họ tên không được quá 100 ký tự')
        .regex(/^[a-zA-ZÀ-ỹ\s]+$/, 'Họ tên chỉ được chứa chữ cái'),
    phone: z
        .string()
        .regex(phoneRegex, 'Số điện thoại không hợp lệ')
        .or(z.string().regex(/^0[0-9]{9,10}$/, 'Số điện thoại không hợp lệ')),
    address_line: z
        .string()
        .min(10, 'Địa chỉ phải có ít nhất 10 ký tự')
        .max(200, 'Địa chỉ không được quá 200 ký tự'),
    ward: z.string().optional(),
    district: z.string().optional(),
    province: z
        .string()
        .min(2, 'Vui lòng nhập tỉnh/thành phố')
        .max(50, 'Tên tỉnh/thành phố không hợp lệ'),
});

export type AddressInput = z.infer<typeof addressSchema>;

/**
 * Checkout Order Schema
 */
export const checkoutOrderSchema = z.object({
    address: addressSchema,
    note: z
        .string()
        .max(500, 'Ghi chú không được quá 500 ký tự')
        .optional(),
    payment_method: z.enum(['bank_transfer', 'cod']).default('bank_transfer'),
});

export type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>;

/**
 * Cart Item Schema
 */
export const cartItemSchema = z.object({
    id: z.string().uuid('ID sản phẩm không hợp lệ'),
    product_id: z.string().uuid('ID sản phẩm không hợp lệ'),
    name: z.string().min(1, 'Tên sản phẩm không được trống'),
    price: z.number().positive('Giá phải lớn hơn 0'),
    quantity: z
        .number()
        .int('Số lượng phải là số nguyên')
        .positive('Số lượng phải lớn hơn 0')
        .max(99, 'Số lượng tối đa là 99'),
    size: z.string().optional(),
    color: z.string().optional(),
    image: z.string().url().optional(),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;

/**
 * Order Creation Schema
 */
export const createOrderSchema = z.object({
    items: z
        .array(cartItemSchema)
        .min(1, 'Giỏ hàng không được trống')
        .max(50, 'Tối đa 50 sản phẩm mỗi đơn'),
    shipping_address: addressSchema,
    customer_note: z
        .string()
        .max(500, 'Ghi chú không được quá 500 ký tự')
        .optional()
        .transform(val => val?.trim() || undefined),
    payment_method: z.enum(['bank_transfer', 'cod']).default('bank_transfer'),
    deposit_amount: z.number().positive('Số tiền đặt cọc phải lớn hơn 0'),
    total_amount: z.number().positive('Tổng tiền phải lớn hơn 0'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * Validation helper function
 */
export function validateCheckoutForm(data: unknown): {
    success: boolean;
    data?: CheckoutOrderInput;
    errors?: Record<string, string>;
} {
    const result = checkoutOrderSchema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors: Record<string, string> = {};
    result.error.issues.forEach((err) => {
        const path = err.path.join('.');
        errors[path] = err.message;
    });

    return { success: false, errors };
}

/**
 * Validate address only
 */
export function validateAddress(data: unknown): {
    success: boolean;
    data?: AddressInput;
    errors?: Record<string, string>;
} {
    const result = addressSchema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors: Record<string, string> = {};
    result.error.issues.forEach((err) => {
        const path = err.path.join('.');
        errors[path] = err.message;
    });

    return { success: false, errors };
}

/**
 * Validate order creation
 */
export function validateCreateOrder(data: unknown): {
    success: boolean;
    data?: CreateOrderInput;
    errors?: Record<string, string>;
} {
    const result = createOrderSchema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors: Record<string, string> = {};
    result.error.issues.forEach((err) => {
        const path = err.path.join('.');
        errors[path] = err.message;
    });

    return { success: false, errors };
}
