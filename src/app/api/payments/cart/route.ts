/**
 * Cart Payment API - Checkout entire cart
 * POST /api/payments/cart
 * 
 * Features:
 * - Uses payment_configs table for bank account info
 * - Gets customer_code from profiles table
 * - Transfer content format: {customer_code}{order_code}
 * - Idempotency key support
 * - Correlation ID for request tracing
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';
import {
    generateParentCode,
    generateTransferContent,
    generateCustomerCode,
    isValidCustomerCode
} from '@/lib/orderCodeGenerator';
import { getCorrelationId, CorrelatedLogger } from '@/lib/utils/correlationId';
import { createSuccessResponse, createErrorResponse, ERROR_MESSAGES } from '@/lib/utils/apiResponse';
import {
    getPaymentSetup,
    getCustomerCode,
} from '@/lib/services/paymentConfigService';
import { BANK_INFO } from '@/lib/vietqr';
import { getProfileId } from '@/lib/utils/getProfileId';
import { stripHtml } from '@/lib/security/sanitize';
import { requireCsrf } from '@/lib/security/csrf';

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

interface CartItem {
    productId?: string;
    productName: string;
    productType: 'product' | 'printing' | 'custom';
    productSku?: string;
    quantity: number;
    unitPrice: number;
    metadata?: Record<string, unknown>;
}

interface CartPayRequest {
    items: CartItem[];
    shippingAddress: {
        full_name: string;
        phone: string;
        address_line: string;
        ward?: string;
        district?: string;
        province: string;
    };
    note?: string;
}

export async function POST(request: NextRequest) {
    const correlationId = getCorrelationId(request.headers);
    const idempotencyKey = request.headers.get('Idempotency-Key');
    const logger = new CorrelatedLogger('CartPay', correlationId);

    try {
        const session = await auth();
        if (!session?.user?.id) {
            logger.warn('Unauthorized access attempt');
            return NextResponse.json(
                createErrorResponse('UNAUTHORIZED', ERROR_MESSAGES.UNAUTHORIZED, { correlationId }),
                { status: 401 }
            );
        }

        const csrf = await requireCsrf(request);
        if (!csrf.valid) {
            return csrf.error!;
        }

        const profileId = await getProfileId(session.user, supabaseAdmin);
        if (!profileId) {
            logger.warn('Profile not found for session');
            return NextResponse.json(
                createErrorResponse('PROFILE_NOT_FOUND', 'Profile not found', { correlationId }),
                { status: 400 }
            );
        }

        logger.info('Processing cart payment request', { userId: profileId, idempotencyKey });

        // Check idempotency for cart payment in 'payments' table
        if (idempotencyKey) {
            const { data: existingPayment } = await supabaseAdmin
                .from('payments')
                .select('*')
                .eq('gateway_response->>idempotency_key', idempotencyKey)
                .single();

            if (existingPayment) {
                logger.info('Returning cached idempotent cart response', { idempotencyKey });
                // Reconstruct response from saved payment
                const meta = existingPayment.gateway_response || {};
                return NextResponse.json(createSuccessResponse({
                    orderId: existingPayment.order_id,
                    orderCode: meta.reference_code,
                    totalAmount: existingPayment.amount,
                    totalQrUrl: meta.qr_url,
                    totalTransferContent: existingPayment.transaction_code, // stored here
                    cached: true
                }));
            }
        }

        // Check idempotency for cart payment in 'payments' table (not order_parent)
        /* Idempotency logic for cart:
           We can store the idempotency key in the 'payments' record.
           If we find a payment with this key, we return the existing order. 
           (Ignoring for now to strictly follow refactoring of creation logic, but good to keep in mind)
        */

        // ... (Skipping idempotency check rewrite inside this block for brevity, focusing on creation)

        const body: CartPayRequest = await request.json();
        const { items, shippingAddress, note } = body;

        if (!items || items.length === 0) {
            logger.warn('Empty cart submitted');
            return NextResponse.json(
                createErrorResponse('VALIDATION_ERROR', 'Giỏ hàng trống', { correlationId }),
                { status: 400 }
            );
        }

        if (!shippingAddress) {
            logger.warn('Missing shipping address');
            return NextResponse.json(
                createErrorResponse('VALIDATION_ERROR', ERROR_MESSAGES.VALIDATION_ERROR, {
                    correlationId,
                    reason: 'MISSING_SHIPPING_ADDRESS'
                }),
                { status: 400 }
            );
        }

        const sanitizedNote = note ? stripHtml(note).slice(0, 500) : null;

        // Validate and normalize cart items (server-side pricing for ready-made products)
        const productIds = items
            .filter(item => item.productType === 'product' && item.productId)
            .map(item => item.productId) as string[];

        let productMap = new Map<string, any>();
        if (productIds.length > 0) {
            const { data: products, error: productError } = await supabaseAdmin
                .from('products')
                .select('id, name, sku, base_price, sale_price, sizes')
                .in('id', productIds);

            if (productError) {
                logger.error('Product lookup failed', productError);
                return NextResponse.json(
                    createErrorResponse('PRODUCT_LOOKUP_FAILED', 'Không thể kiểm tra sản phẩm', { correlationId }),
                    { status: 500 }
                );
            }

            productMap = new Map((products || []).map(p => [p.id, p]));
        }

        const normalizedItems: CartItem[] = [];
        for (const item of items) {
            if (!item.quantity || item.quantity <= 0) {
                return NextResponse.json(
                    createErrorResponse('VALIDATION_ERROR', 'Số lượng không hợp lệ', { correlationId }),
                    { status: 400 }
                );
            }

            if (item.productType === 'product' && item.productId) {
                const product = productMap.get(item.productId);
                if (!product) {
                    return NextResponse.json(
                        createErrorResponse('PRODUCT_NOT_FOUND', 'Sản phẩm không tồn tại', { correlationId }),
                        { status: 404 }
                    );
                }

                const sizeName = typeof item.metadata?.size === 'string' ? item.metadata.size : undefined;
                let unitPrice = product.sale_price ?? product.base_price ?? 0;

                if (sizeName && Array.isArray(product.sizes)) {
                    const sizeObj = product.sizes.find((s: any) => s?.name === sizeName);
                    if (sizeObj && typeof sizeObj.price === 'number') {
                        unitPrice = sizeObj.price;
                    }
                }

                normalizedItems.push({
                    ...item,
                    productName: product.name,
                    productSku: product.sku,
                    unitPrice,
                });
                continue;
            }

            if (!item.unitPrice || item.unitPrice <= 0) {
                return NextResponse.json(
                    createErrorResponse('VALIDATION_ERROR', 'Đơn giá không hợp lệ', { correlationId }),
                    { status: 400 }
                );
            }

            normalizedItems.push(item);
        }

        const shippingFee = 0;
        const subtotal = normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const totalAmount = subtotal + shippingFee;

        const typeSet = new Set(normalizedItems.map(item => item.productType));
        let orderType: 'ready_made' | 'custom' | 'printing' = 'ready_made';
        if (typeSet.size === 1) {
            const onlyType = Array.from(typeSet)[0];
            if (onlyType === 'printing') orderType = 'printing';
            if (onlyType === 'custom') orderType = 'custom';
        }

        // 1. Get/Generate Customer Code
        const rawCustomerCode = await getCustomerCode(profileId, session.user.email);
        let customerCode: string;

        const isCustomerCodeValid = rawCustomerCode ? isValidCustomerCode(rawCustomerCode) : false;

        if (isCustomerCodeValid && rawCustomerCode) {
            customerCode = rawCustomerCode;
        } else {
            customerCode = generateCustomerCode();
            await supabaseAdmin.from('profiles').update({ customer_code: customerCode }).eq('id', profileId);
        }

        // 2. Generate Order Code (using Parent Code format for cart as it's the main code)
        const orderCode = generateParentCode();

        // 3. Generate Transfer Content
        const transferContent = generateTransferContent(customerCode, orderCode);

        // 4. Prepare Items for JSONB
        const orderItems = normalizedItems.map(item => ({
            id: crypto.randomUUID(),
            product_id: item.productId || null,
            name: item.productName,
            sku: item.productSku || null,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.unitPrice * item.quantity,
            configuration: item.metadata || {},
            type: item.productType
        }));

        // 5. Create Single Order
        // For Cart, we use 'orders' table.
        // We might want to store 'note' in 'notes' column.

        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
                order_code: orderCode, // 8-char code
                user_id: profileId,
                order_type: orderType,
                subtotal: subtotal,
                shipping_fee: shippingFee,
                total_amount: totalAmount,
                status: 'pending',
                payment_status: 'pending', // Waiting for payment
                shipping_address_snapshot: shippingAddress,
                notes: sanitizedNote,
                items: orderItems, // JSONB
                admin_notes: JSON.stringify({
                    customer_code: customerCode,
                    transfer_content: transferContent,
                    correlation_id: correlationId,
                    source: 'cart'
                })
            })
            .select()
            .single();

        if (orderError || !order) {
            logger.error('Order creation failed', orderError);
            return NextResponse.json(
                createErrorResponse('ORDER_CREATE_FAILED', ERROR_MESSAGES.ORDER_CREATE_FAILED, {
                    correlationId,
                    reason: orderError?.message
                }),
                { status: 500 }
            );
        }

        // Insert normalized order_items for relational access
        const { error: orderItemsError } = await supabaseAdmin
            .from('order_items')
            .insert(orderItems.map((item) => ({
                order_id: order.id,
                product_id: item.product_id,
                name: item.name,
                sku: item.sku,
                size: typeof item.configuration?.size === 'string' ? item.configuration.size : null,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
                configuration: item.configuration || {},
            })));

        if (orderItemsError) {
            logger.warn('Order items insert failed (non-fatal)', { error: orderItemsError });
        }

        // 6. Payment Setup (Total Amount)
        // Use 'product' type config or default for cart total
        const paymentSetup = await getPaymentSetup(
            profileId,
            'product',
            orderCode,
            totalAmount
        );

        // 7. Create Payment Record (payments table)
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        const { error: paymentError } = await supabaseAdmin
            .from('payments')
            .insert({
                order_id: order.id,
                transaction_code: transferContent,
                amount: totalAmount,
                status: 'pending',
                method: 'QR',
                gateway_response: {
                    qr_url: paymentSetup.qrUrl,
                    bank_code: paymentSetup.bankInfo.bank_code,
                    account_no: paymentSetup.bankInfo.account_no,
                    account_name: paymentSetup.bankInfo.account_name,
                    expires_at: expiresAt.toISOString(),
                    idempotency_key: idempotencyKey || null,
                    correlation_id: correlationId,
                    reference_code: orderCode // Using order_code as reference
                }
            });

        if (paymentError) {
            logger.error('Payment record creation failed', paymentError);
        }

        return NextResponse.json(createSuccessResponse({
            orderId: order.id,
            orderCode: orderCode, // Previously codeParent
            customerCode,
            totalAmount,
            shippingFee,
            totalQrUrl: paymentSetup.qrUrl,
            totalTransferContent: transferContent, // Previously totalTransferContent
            correlationId,
            items: orderItems.map(i => ({
                productName: i.name,
                quantity: i.quantity,
                amount: i.total_price
            })),
            bankInfo: {
                bankCode: paymentSetup.bankInfo.bank_code,
                accountNo: paymentSetup.bankInfo.account_no,
                accountName: paymentSetup.bankInfo.account_name,
                bankName: BANK_INFO[paymentSetup.bankInfo.bank_code as keyof typeof BANK_INFO]?.shortName || paymentSetup.bankInfo.bank_code,
            },
        }));
    } catch (error) {
        logger.error('Unexpected error in cart payment', error);
        return NextResponse.json(
            createErrorResponse('INTERNAL_ERROR', ERROR_MESSAGES.INTERNAL_ERROR, { correlationId }),
            { status: 500 }
        );
    }
}
