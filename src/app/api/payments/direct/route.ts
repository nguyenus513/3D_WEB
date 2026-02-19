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
    isValidHex,
    generateHex
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
        const finalAmount = totalPrice;

        // 1. Get or Generate Customer Code (10 hex)
        const rawCustomerCode = await getCustomerCode(session.user.id, session.user.email);
        let customerCode: string;

        const isCustomerCodeValid = rawCustomerCode && isValidCustomerCode(rawCustomerCode);

        if (isCustomerCodeValid && rawCustomerCode) {
            customerCode = rawCustomerCode;
        } else {
            customerCode = generateCustomerCode();
            logger.info('Generated new 10-hex customer code', { customerCode });

            await supabaseAdmin
                .from('users')
                .update({ customer_code: customerCode })
                .eq('id', session.user.id);
        }

        // 2. Generate pure hex codes
        // order_code = 8 hex (for the order)
        // item_code = 8 hex (for the order item)
        // full_code = {order_code}_{item_code} = 17 chars
        const codeParent = generateParentCode(); // 8 hex

        // Generate item_code as separate 8 hex (or use SKU if valid)
        let codeChild: string;
        if (body.productSku && body.productSku.length === 8 && isValidHex(body.productSku)) {
            codeChild = body.productSku.toUpperCase();
        } else {
            codeChild = generateHex(8); // 8 hex
        }

        // 3. Payment Setup (Manual to enforce content format)
        // Get bank info
        const orderType = getOrderTypeForProduct(productType);
        const bankInfo = await getPaymentConfig(orderType);

        // SECURITY: Fail if no config found - don't use hardcoded fallback
        if (!bankInfo) {
            logger.error('Payment config not found for order type', { orderType });
            return NextResponse.json(
                createErrorResponse('PAYMENT_CONFIG_MISSING', 'Cấu hình thanh toán không tồn tại. Vui lòng liên hệ admin.', {
                    correlationId,
                    reason: `Missing payment_configs for order_type: ${orderType}`
                }),
                { status: 500 }
            );
        }

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

        // Create order in orders table
        const { data: newOrder, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
                order_code: codeParent,
                user_id: session.user.id,
                order_type: productType === 'printing' ? 'print_3d' : productType,
                subtotal: totalPrice,
                total_amount: finalAmount,
                deposit_amount: finalAmount,
                status: 'pending',
                payment_status: 'pending',
                shipping_address: shippingAddress || null,
                customer_note: null,
            })
            .select()
            .single();

        if (orderError || !newOrder) {
            logger.error('Order creation failed', orderError);
            return NextResponse.json(
                createErrorResponse('ORDER_CREATE_FAILED', ERROR_MESSAGES.ORDER_CREATE_FAILED, {
                    correlationId,
                    reason: orderError?.message || 'DATABASE_ERROR'
                }),
                { status: 500 }
            );
        }

        // Create order_item
        const { data: orderItem, error: itemError } = await supabaseAdmin
            .from('order_items')
            .insert({
                order_id: newOrder.id,
                product_id: productId || null,
                item_code: codeChild, // 8 hex
                full_code: `${codeParent}_${codeChild}`, // 8_8 = 17 chars
                name: productName,
                sku: body.productSku || null,
                quantity,
                unit_price: unitPrice,
                total_price: totalPrice,
                item_type: productType,
                production_status: 'waiting',
                spec: metadata || {},
            })
            .select()
            .single();

        if (itemError) {
            logger.error('Order item creation failed', itemError);
            // Rollback order
            await supabaseAdmin.from('orders').delete().eq('id', newOrder.id);
            return NextResponse.json(
                createErrorResponse('ORDER_CREATE_FAILED', ERROR_MESSAGES.ORDER_CREATE_FAILED, {
                    correlationId,
                    reason: itemError?.message || 'ITEM_CREATE_ERROR'
                }),
                { status: 500 }
            );
        }

        logger.info('Order created successfully', { orderId: newOrder.id });

        // Create payment record in payments table
        const { error: paymentError } = await supabaseAdmin
            .from('payments')
            .insert({
                order_id: newOrder.id,
                transaction_code: transferContent,
                amount: finalAmount,
                method: 'qr',
                status: 'pending',
                gateway_response: {
                    qr_url: qrUrl,
                    bank_code: bankInfo.bank_code,
                    account_no: bankInfo.account_no,
                    account_name: bankInfo.account_name,
                    transfer_content: transferContent,
                    customer_code: customerCode,
                    correlation_id: correlationId,
                    idempotency_key: idempotencyKey,
                },
            });

        if (paymentError) {
            logger.error('Payment record creation failed', paymentError);
        }

        logger.info('Direct payment completed successfully', {
            orderId: newOrder.id,
            amount: finalAmount,
            codeChild,
            customerCode: customerCode,
            transferContent: transferContent
        });


        return NextResponse.json(createSuccessResponse({
            orderId: newOrder.id,
            orderCode: codeParent,
            codeChild,
            customerCode: customerCode,
            amount: finalAmount,
            qrUrl: qrUrl,
            transferContent: transferContent,
            correlationId,
            bankInfo: {
                bankCode: bankInfo.bank_code,
                accountNo: bankInfo.account_no,
                accountName: bankInfo.account_name,
                bankName: BANK_INFO[bankInfo.bank_code as keyof typeof BANK_INFO]?.shortName || bankInfo.bank_code,
            },
        }));

    } catch (error: any) {
        logger.error('Unexpected error in direct payment', error);

        // Return detailed error for debugging (remove in production)
        return NextResponse.json(
            createErrorResponse('INTERNAL_ERROR', ERROR_MESSAGES.INTERNAL_ERROR, {
                correlationId,
                debug: {
                    message: error?.message || String(error),
                    name: error?.name,
                    stack: error?.stack?.split('\n').slice(0, 5)
                }
            }),
            { status: 500 }
        );
    }
}
