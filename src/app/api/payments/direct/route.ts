/**
 * Direct Payment API - Single Product Pay Now
 * POST /api/payments/direct
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
    generateQRUrl
} from '@/lib/services/paymentConfigService';
import { BANK_INFO } from '@/lib/vietqr';
import { getProfileId } from '@/lib/utils/getProfileId';
import { requireCsrf } from '@/lib/security/csrf';

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

        logger.info('Processing direct payment request', { userId: profileId, idempotencyKey });

        // Check idempotency - return cached result if exists
        if (idempotencyKey) {
            const { data: existingPayment } = await supabaseAdmin
                .from('payments')
                .select('*')
                .eq('gateway_response->>idempotency_key', idempotencyKey) // Helper since it's now in JSON
                .single();

            if (existingPayment) {
                logger.info('Returning cached idempotent response', { idempotencyKey });
                const meta = existingPayment.gateway_response || {};
                return NextResponse.json(createSuccessResponse({
                    orderId: existingPayment.order_id,
                    codeChild: meta.reference_code,
                    amount: existingPayment.amount,
                    qrUrl: meta.qr_url,
                    expiresAt: meta.expires_at,
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

        let finalName = productName;
        let finalSku = body.productSku || null;
        let finalUnitPrice = unitPrice;

        if (productType === 'product' && productId) {
            const { data: product, error: productError } = await supabaseAdmin
                .from('products')
                .select('id, name, sku, base_price, sale_price, sizes')
                .eq('id', productId)
                .single();

            if (productError || !product) {
                return NextResponse.json(
                    createErrorResponse('PRODUCT_NOT_FOUND', 'Sản phẩm không tồn tại', { correlationId }),
                    { status: 404 }
                );
            }

            finalName = product.name;
            finalSku = product.sku || finalSku;

            const sizeName = typeof metadata?.size === 'string' ? metadata.size : undefined;
            let computedPrice = product.sale_price ?? product.base_price ?? 0;

            if (sizeName && Array.isArray(product.sizes)) {
                const sizeObj = product.sizes.find((s: any) => s?.name === sizeName);
                if (sizeObj && typeof sizeObj.price === 'number') {
                    computedPrice = sizeObj.price;
                }
            }

            finalUnitPrice = computedPrice;
        }

        const totalPrice = finalUnitPrice * quantity;
        const shippingFee = 0;
        const finalAmount = totalPrice + shippingFee;

        // 1. Get or Generate Customer Code (10 hex)
        const rawCustomerCode = await getCustomerCode(profileId, session.user.email);
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
                .eq('id', profileId);
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

        // Create order (Unified Schema)
        // Store product details in 'items' JSONB column
        // Map 'codeChild' to 'order_code'
        const orderItems = [{
            id: crypto.randomUUID(),
            product_id: productId || null,
            name: finalName,
            sku: finalSku,
            quantity: quantity,
            unit_price: finalUnitPrice,
            total_price: totalPrice,
            configuration: metadata || {},
            type: productType // Store type in item config/metadata if needed, or rely on product
        }];

        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
                order_code: codeChild,
                user_id: profileId,
                order_type: getOrderTypeForProduct(productType),
                subtotal: totalPrice,
                shipping_fee: shippingFee,
                total_amount: finalAmount,
                status: 'pending',
                payment_status: 'pending',
                shipping_address_snapshot: shippingAddress,
                items: orderItems, // JSONB column
                // Store extra metadata in specific columns if available or note
                notes: `Direct Pay: ${customerCode}`,
                // We can store extended metadata in a generic column if schema supports it, 
                // but for now we map what we can. 
                // If we need parent_code/transfer_content, maybe put in admin_notes or check if we have a metadata column? 
                // Orders table doesn't have generic metadata column in the schema I saw, assumes structured fields.
                // storing critical payment info in admin_notes for now or relying on payments table.
                admin_notes: JSON.stringify({
                    parent_code: codeParent,
                    customer_code: customerCode,
                    transfer_content: transferContent,
                    correlation_id: correlationId,
                    bank_info: {
                        bank_code: bankInfo.bank_code,
                        account_no: bankInfo.account_no
                    }
                })
            })
            .select()
            .single();

        if (orderError || !order) {
            logger.error('Order creation failed', orderError);
            return NextResponse.json(
                createErrorResponse('ORDER_CREATE_FAILED', ERROR_MESSAGES.ORDER_CREATE_FAILED, {
                    correlationId,
                    reason: orderError?.message || 'DATABASE_ERROR'
                }),
                { status: 500 }
            );
        }

        logger.info('Order created successfully', { orderId: order.id });

        // Insert normalized order_items
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

        // Create payment record (Table: 'payments')
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        const { error: paymentError } = await supabaseAdmin
            .from('payments') // FIXED: 'payment' -> 'payments'
            .insert({
                order_id: order.id,
                transaction_code: transferContent, // Map transfer content to transaction_code or similar
                amount: finalAmount,
                status: 'pending',
                method: 'QR',
                gateway_response: {
                    qr_url: qrUrl,
                    bank_code: bankInfo.bank_code,
                    account_no: bankInfo.account_no,
                    account_name: bankInfo.account_name,
                    expires_at: expiresAt.toISOString(),
                    idempotency_key: idempotencyKey || null,
                    correlation_id: correlationId,
                    reference_code: codeChild
                }
            });

        if (paymentError) {
            logger.error('Payment record creation failed', paymentError);
            // Non-critical (?) but bad state.
        }

        logger.info('Direct payment completed successfully', {
            orderId: order.id,
            amount: finalAmount,
            codeChild,
            customerCode: customerCode,
            transferContent: transferContent
        });

        return NextResponse.json(createSuccessResponse({
            orderId: order.id,
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
    } catch (error: any) {
        logger.error('Unexpected error in direct payment', error);

        return NextResponse.json(
            createErrorResponse('INTERNAL_ERROR', ERROR_MESSAGES.INTERNAL_ERROR, {
                correlationId
            }),
            { status: 500 }
        );
    }
}
