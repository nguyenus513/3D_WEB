/**
 * Cart Payment API - Checkout entire cart
 * POST /api/payments/cart
 * 
 * Features:
 * - Uses payment_configs table for bank account info
 * - Gets customer_code from profiles table
 * - Transfer content format: {customer_code}-{order_code}
 * - Idempotency key support
 * - Correlation ID for request tracing
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { generateHexCode } from '@/lib/utils/generateHexCode';
import {
    generateParentCode,
    generateChildCode,
    generateTransferContent,
    generateCustomerCode,
    isValidCustomerCode,
    isValidHex
} from '@/lib/orderCodeGenerator';
import { getCorrelationId, CorrelatedLogger } from '@/lib/utils/correlationId';
import { createSuccessResponse, createErrorResponse, ERROR_MESSAGES } from '@/lib/utils/apiResponse';
import {
    getPaymentSetup,
    getCustomerCode,
    generateFallbackCustomerCode,
} from '@/lib/services/paymentConfigService';
import { BANK_INFO } from '@/lib/vietqr';

const supabaseAdmin = getAdminSupabase();

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

        logger.info('Processing cart payment request', { userId: session.user.id, idempotencyKey });

        // Check idempotency for cart payment
        if (idempotencyKey) {
            const { data: existingParent } = await supabaseAdmin
                .from('order_parent')
                .select('*')
                .eq('note', `idempotency:${idempotencyKey}`)
                .single();

            if (existingParent) {
                logger.info('Returning cached idempotent cart response', { idempotencyKey });
                const { data: children } = await supabaseAdmin
                    .from('order_child')
                    .select('*')
                    .eq('parent_id', existingParent.id);

                return NextResponse.json(createSuccessResponse({
                    parentId: existingParent.id,
                    codeParent: existingParent.code_parent,
                    totalAmount: existingParent.total_amount,
                    items: children?.map((c: any) => ({
                        orderId: c.id,
                        codeChild: c.code_child,
                        productName: c.product_name,
                        amount: c.total_price,
                        qrUrl: c.payment_qr_url,
                    })) || [],
                    cached: true,
                }));
            }
        }

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

        const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const totalAmount = subtotal;

        // 1. Get or Generate Customer Code (10 hex)
        // Try to get from profile first
        const rawCustomerCode = await getCustomerCode(session.user.id, session.user.email);
        let customerCode: string;

        // Validate if existing code is 10-hex
        const isCustomerCodeValid = rawCustomerCode ? isValidCustomerCode(rawCustomerCode) : false;

        if (isCustomerCodeValid && rawCustomerCode) {
            customerCode = rawCustomerCode;
        } else {
            // Generate new random 10-hex code
            customerCode = generateCustomerCode();
            logger.info('Generated new 10-hex customer code', { customerCode });

            // Save to profile for future use
            const { error: profileError } = await supabaseAdmin
                .from('users')
                .update({ customer_code: customerCode })
                .eq('id', session.user.id);

            if (profileError) {
                logger.warn('Failed to save new customer code to profile', { error: profileError.message });
                // Proceed anyway with the generated code for this order
            }
        }

        logger.info('Using customer code', { customerCode });

        // Generate parent code (8 hex)
        const codeParent = generateParentCode();

        // Generate transfer content for QR (customer 10 + parent 8 = 18 chars)
        const transferContent = generateTransferContent(customerCode, codeParent);

        logger.info('Generated parent code', { codeParent, customerCode, transferContent });

        // Create parent order
        const { data: parentOrder, error: parentError } = await supabaseAdmin
            .from('order_parent')
            .insert({
                code_parent: codeParent,
                user_id: session.user.id,
                total_amount: totalAmount,
                status: 'pending',
                shipping_address: shippingAddress,
                shipping_fee: 0,
                note: idempotencyKey ? `idempotency:${idempotencyKey}` : note,
                metadata: {
                    customer_code: customerCode,
                    transfer_content: transferContent,
                },
            })
            .select()
            .single();

        if (parentError || !parentOrder) {
            logger.error('Parent order creation failed', parentError);
            return NextResponse.json(
                createErrorResponse('ORDER_CREATE_FAILED', ERROR_MESSAGES.ORDER_CREATE_FAILED, {
                    correlationId,
                    reason: parentError?.message
                }),
                { status: 500 }
            );
        }

        logger.info('Parent order created', { parentId: parentOrder.id });

        // Create child orders
        const childOrders = [];

        for (const item of items) {
            // Determine SKU suffix (use if 4-hex valid)
            let skuSuffix: string | undefined = undefined;
            if (item.productSku && item.productSku.length === 8 && isValidHex(item.productSku)) {
                skuSuffix = item.productSku;
            }

            // Generate child code (parent 8 + suffix 4 = 12 hex)
            const codeChild = generateChildCode(codeParent, skuSuffix);

            const itemTotal = item.unitPrice * item.quantity;

            // Get payment setup for this item
            const paymentSetup = await getPaymentSetup(
                session.user.id,
                item.productType,
                codeChild,
                itemTotal
            );

            const { data: childOrder, error: childError } = await supabaseAdmin
                .from('order_child')
                .insert({
                    parent_id: parentOrder.id,
                    code_child: codeChild,
                    product_sku: item.productSku || null,
                    user_id: session.user.id,
                    product_id: item.productId || null,
                    product_type: item.productType,
                    product_name: item.productName,
                    quantity: item.quantity,
                    unit_price: item.unitPrice,
                    total_price: itemTotal,
                    status: 'pending',
                    payment_qr_url: paymentSetup.qrUrl,
                    metadata: {
                        ...item.metadata,
                        parent_code: codeParent,
                        customer_code: customerCode,
                        transfer_content: transferContent,
                        correlation_id: correlationId,
                    },
                })
                .select()
                .single();

            if (childError) {
                logger.error('Child order creation failed', childError, { productName: item.productName });
                continue;
            }

            // Create payment record
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
            await supabaseAdmin.from('payment').insert({
                order_type: 'child',
                order_id: childOrder.id,
                reference_code: codeChild,
                amount: itemTotal,
                status: 'pending',
                method: 'QR',
                qr_url: paymentSetup.qrUrl,
                bank_code: paymentSetup.bankInfo.bank_code,
                account_no: paymentSetup.bankInfo.account_no,
                account_name: paymentSetup.bankInfo.account_name,
                expires_at: expiresAt.toISOString(),
                correlation_id: correlationId,
            });

            childOrders.push({
                orderId: childOrder.id,
                codeChild,
                productName: item.productName,
                productType: item.productType,
                quantity: item.quantity,
                amount: itemTotal,
                qrUrl: paymentSetup.qrUrl,
                transferContent: paymentSetup.transferContent,
            });
        }

        // Total QR for entire order
        const totalPaymentSetup = await getPaymentSetup(
            session.user.id,
            'product', // Use ready_made config for total
            codeParent,
            totalAmount
        );

        logger.info('Cart payment completed', {
            parentId: parentOrder.id,
            childCount: childOrders.length,
            totalAmount,
            customerCode,
            totalTransferContent: totalPaymentSetup.transferContent
        });

        return NextResponse.json(createSuccessResponse({
            parentId: parentOrder.id,
            codeParent,
            customerCode,
            subtotal,
            totalQrUrl: totalPaymentSetup.qrUrl,
            totalTransferContent: totalPaymentSetup.transferContent,
            correlationId,
            items: childOrders,
            bankInfo: {
                bankCode: totalPaymentSetup.bankInfo.bank_code,
                accountNo: totalPaymentSetup.bankInfo.account_no,
                accountName: totalPaymentSetup.bankInfo.account_name,
                bankName: BANK_INFO[totalPaymentSetup.bankInfo.bank_code as keyof typeof BANK_INFO]?.shortName || totalPaymentSetup.bankInfo.bank_code,
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
