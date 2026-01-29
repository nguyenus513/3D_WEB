/**
 * Atomic Order API
 * POST /api/orders/atomic
 * 
 * Uses RPC function for atomic stock check and order placement.
 * Prevents race conditions and overselling.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';
import { createSuccessResponse, createErrorResponse, ERROR_MESSAGES } from '@/lib/utils/apiResponse';

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

interface AtomicOrderRequest {
    productId: string;
    productSku: string;
    productName: string;
    productType?: 'product' | 'print' | 'custom';
    quantity: number;
    unitPrice: number;
    metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
    const correlationId = `atomic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
        // Authenticate
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                createErrorResponse('UNAUTHORIZED', ERROR_MESSAGES.UNAUTHORIZED, { correlationId }),
                { status: 401 }
            );
        }

        const userId = session.user.id;

        // Parse request
        const body: AtomicOrderRequest = await request.json();
        const {
            productId,
            productSku,
            productName,
            productType = 'product',
            quantity,
            unitPrice,
            metadata = {}
        } = body;

        // Validate required fields
        if (!productId || !productName || !quantity || !unitPrice) {
            return NextResponse.json(
                createErrorResponse('VALIDATION_ERROR', 'Missing required fields', {
                    correlationId,
                    required: ['productId', 'productName', 'quantity', 'unitPrice']
                }),
                { status: 400 }
            );
        }

        if (quantity < 1) {
            return NextResponse.json(
                createErrorResponse('VALIDATION_ERROR', 'Quantity must be at least 1', { correlationId }),
                { status: 400 }
            );
        }

        console.log('[AtomicOrder] Calling RPC', {
            userId,
            productId,
            quantity,
            correlationId
        });

        // Call RPC function for atomic stock check and order creation
        const { data: result, error: rpcError } = await supabaseAdmin
            .rpc('place_order_with_stock_check', {
                p_user_id: userId,
                p_product_id: productId,
                p_product_sku: productSku || '',
                p_product_name: productName,
                p_product_type: productType,
                p_quantity: quantity,
                p_unit_price: unitPrice,
                p_metadata: {
                    ...metadata,
                    correlation_id: correlationId,
                }
            });

        if (rpcError) {
            console.error('[AtomicOrder] RPC error', { rpcError, correlationId });
            return NextResponse.json(
                createErrorResponse('INTERNAL_ERROR', rpcError.message, { correlationId }),
                { status: 500 }
            );
        }

        // Handle RPC result
        if (!result.success) {
            const statusCode = result.error === 'INSUFFICIENT_STOCK' ? 409 : 400;

            console.warn('[AtomicOrder] Order failed', {
                error: result.error,
                available: result.available,
                requested: result.requested,
                correlationId
            });

            return NextResponse.json(
                createErrorResponse(result.error, result.message, {
                    correlationId,
                    available: result.available,
                    requested: result.requested
                }),
                { status: statusCode }
            );
        }

        // Success
        console.log('[AtomicOrder] Order created successfully', {
            orderId: result.order_id,
            codeChild: result.code_child,
            stockBefore: result.stock_before,
            stockAfter: result.stock_after,
            correlationId
        });

        return NextResponse.json(createSuccessResponse({
            orderId: result.order_id,
            codeChild: result.code_child,
            customerCode: result.customer_code,
            transferContent: result.transfer_content,
            amount: result.amount,
            qrUrl: result.qr_url,
            stockInfo: {
                before: result.stock_before,
                after: result.stock_after,
            },
            bankInfo: result.bank_info,
            correlationId,
        }));

    } catch (error) {
        console.error('[AtomicOrder] Unexpected error', { error, correlationId });
        return NextResponse.json(
            createErrorResponse('INTERNAL_ERROR', ERROR_MESSAGES.INTERNAL_ERROR, { correlationId }),
            { status: 500 }
        );
    }
}
