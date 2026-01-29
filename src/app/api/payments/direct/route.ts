/**
 * Direct Payment API - Single Product Pay Now
 * POST /api/payments/direct
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
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';
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
    getCustomerCode,
    getOrderTypeForProduct,
    getPaymentConfig,
    getDefaultPaymentConfig,
    generateQRUrl
} from '@/lib/services/paymentConfigService';
import { BANK_INFO } from '@/lib/vietqr';

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

interface DirectPayRequest {
    productId: string;
    productName: string;
    productType: 'product' | 'printing' | 'custom';
    productSku?: string;
    quantity: number;
    unitPrice: number;
    metadata?: Record<string, unknown>;
    shippingAddress?: {
        full_name: string;
        phone: string;
        address_line: string;
        ward?: string;
        district?: string;
        province: string;
    };
}

export async function POST(request: NextRequest) {
    const correlationId = getCorrelationId(request.headers);
    const idempotencyKey = request.headers.get('Idempotency-Key');
    const logger = new CorrelatedLogger('DirectPay', correlationId);

    try {
        // Check authentication
        const session = await auth();
        if (!session?.user?.id) {
            logger.warn('Unauthorized access attempt');
            return NextResponse.json(
                createErrorResponse('UNAUTHORIZED', ERROR_MESSAGES.UNAUTHORIZED, { correlationId }),
                { status: 401 }
            );
        }

        logger.info('Processing direct payment request', { userId: session.user.id, idempotencyKey });

        // Check idempotency - return cached result if exists
        if (idempotencyKey) {
            const { data: existingPayment } = await supabaseAdmin
                .from('payment')
                .select('*')
                .eq('idempotency_key', idempotencyKey)
                .single();

            if (existingPayment) {
                logger.info('Returning cached idempotent response', { idempotencyKey });
                return NextResponse.json(createSuccessResponse({
                    orderId: existingPayment.order_id,
                    codeChild: existingPayment.reference_code,
                    amount: existingPayment.amount,
                    qrUrl: existingPayment.qr_url,
                    expiresAt: existingPayment.expires_at,
                    cached: true,
                }));
            }
        }

        // Parse and validate request body
        const body: DirectPayRequest = await request.json();
        const { productId, productName, productType, quantity, unitPrice, metadata, shippingAddress } = body;

        if (!productName || !quantity || !unitPrice || quantity <= 0) {
            logger.warn('Validation failed', { productName, quantity, unitPrice });
            return NextResponse.json(
                createErrorResponse('VALIDATION_ERROR', ERROR_MESSAGES.VALIDATION_ERROR, {
                    correlationId,
                    reason: 'Missing required fields'
                }),
                { status: 400 }
            );
        }

        const totalPrice = unitPrice * quantity;
        const shippingFee = shippingAddress ? 30000 : 0;
        const finalAmount = totalPrice + shippingFee;

        // 1. Get or Generate Customer Code (10 hex)
        const rawCustomerCode = await getCustomerCode(session.user.id);
        let customerCode: string;

        const isCustomerCodeValid = rawCustomerCode && isValidCustomerCode(rawCustomerCode);

        if (isCustomerCodeValid && rawCustomerCode) {
            customerCode = rawCustomerCode;
        } else {
            customerCode = generateCustomerCode();
            logger.info('Generated new 10-hex customer code', { customerCode });

            await supabaseAdmin
                .from('profiles')
                .update({ customer_code: customerCode })
                .eq('id', session.user.id);
        }

        // 2. Generate pure hex codes
        const codeParent = generateParentCode();

        // Determine SKU suffix
        let skuSuffix: string | undefined = undefined;
        if (body.productSku && body.productSku.length === 8 && isValidHex(body.productSku)) {
            skuSuffix = body.productSku;
        }

        const codeChild = generateChildCode(codeParent, skuSuffix);

        // 3. Payment Setup (Manual to enforce content format)
        // Get bank info
        const orderType = getOrderTypeForProduct(productType);
        const bankInfo = await getPaymentConfig(orderType) || getDefaultPaymentConfig();

        // Generate transfer content: Customer(10) + Parent(8)
        const transferContent = generateTransferContent(customerCode, codeParent);

        // Generate QR URL
        const qrUrl = generateQRUrl(
            bankInfo.bank_code,
            bankInfo.account_no,
            bankInfo.account_name,
            finalAmount,
            transferContent
        );

        logger.info('Payment setup ready', {
            codeChild,
            codeParent,
            customerCode,
            transferContent,
            bankCode: bankInfo.bank_code
        });

        // Create order_child
        const { data: orderChild, error: orderError } = await supabaseAdmin
            .from('order_child')
            .insert({
                code_child: codeChild,
                product_sku: body.productSku || null,
                parent_id: null,
                user_id: session.user.id,
                product_id: productId || null,
                product_type: productType,
                product_name: productName,
                quantity,
                unit_price: unitPrice,
                total_price: totalPrice,
                status: 'pending',
                payment_qr_url: qrUrl,
                metadata: {
                    ...metadata,
                    parent_code: codeParent,
                    customer_code: customerCode,
                    transfer_content: transferContent,
                    shipping_address: shippingAddress,
                    shipping_fee: shippingFee,
                    correlation_id: correlationId,
                    bank_code: bankInfo.bank_code,
                    account_no: bankInfo.account_no,
                    account_name: bankInfo.account_name,
                },
            })
            .select()
            .single();

        if (orderError || !orderChild) {
            logger.error('Order creation failed', orderError);
            return NextResponse.json(
                createErrorResponse('ORDER_CREATE_FAILED', ERROR_MESSAGES.ORDER_CREATE_FAILED, {
                    correlationId,
                    reason: orderError?.message || 'DATABASE_ERROR'
                }),
                { status: 500 }
            );
        }

        logger.info('Order created successfully', { orderId: orderChild.id });

        // Create payment record
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        const { error: paymentError } = await supabaseAdmin
            .from('payment')
            .insert({
                order_type: 'direct_child',
                order_id: orderChild.id,
                reference_code: codeChild,
                amount: finalAmount,
                status: 'pending',
                method: 'QR',
                qr_url: qrUrl,
                bank_code: bankInfo.bank_code,
                account_no: bankInfo.account_no,
                account_name: bankInfo.account_name,
                expires_at: expiresAt.toISOString(),
                idempotency_key: idempotencyKey || null,
                correlation_id: correlationId,
            });

        if (paymentError) {
            logger.error('Payment record creation failed', paymentError);
        }

        logger.info('Direct payment completed successfully', {
            orderId: orderChild.id,
            amount: finalAmount,
            codeChild,
            customerCode: customerCode,
            transferContent: transferContent
        });

        return NextResponse.json(createSuccessResponse({
            orderId: orderChild.id,
            codeChild,
            customerCode: customerCode,
            amount: finalAmount,
            qrUrl: qrUrl,
            transferContent: transferContent,
            expiresAt: expiresAt.toISOString(),
            correlationId,
            bankInfo: {
                bankCode: bankInfo.bank_code,
                accountNo: bankInfo.account_no,
                accountName: bankInfo.account_name,
                bankName: BANK_INFO[bankInfo.bank_code as keyof typeof BANK_INFO]?.shortName || bankInfo.bank_code,
            },
        }));
    } catch (error) {
        logger.error('Unexpected error in direct payment', error);
        return NextResponse.json(
            createErrorResponse('INTERNAL_ERROR', ERROR_MESSAGES.INTERNAL_ERROR, { correlationId }),
            { status: 500 }
        );
    }
}
