/**
 * Custom Order Creation API
 * Creates custom orders (single/couple/group) with file uploads
 * Uses unified orders + order_items tables
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';
import { generateId } from '@/lib/generateId';

interface CustomOrderRequest {
    type: 'single' | 'couple' | 'group';
    size: string;
    notes?: string;
    shippingAddress: {
        full_name: string;
        phone: string;
        address_line?: string;
        ward?: string;
        district?: string;
        province: string;
    };
    images: Array<{
        id: string;
        name: string;
        url?: string;
    }>;
}

// Price configuration
const BASE_PRICES: Record<string, number> = {
    single: 350000,
    couple: 550000,
    group: 750000,
};

const SIZE_MULTIPLIERS: Record<string, number> = {
    S: 1,
    M: 1.3,
    L: 1.6,
    XL: 2,
};

export async function POST(request: NextRequest) {
    try {
        // Verify session
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
                { status: 401 }
            );
        }

        const supabase = getAdminSupabase();

        // Get profile ID
        const userId = await getProfileId(session.user, supabase);
        if (!userId) {
            return NextResponse.json(
                { success: false, error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found' } },
                { status: 400 }
            );
        }

        // Parse request body
        const body: CustomOrderRequest = await request.json();
        const { type, size, notes, shippingAddress, images } = body;

        // Validate required fields
        if (!type || !shippingAddress?.full_name || !shippingAddress?.phone || !shippingAddress?.province) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
                { status: 400 }
            );
        }

        // Calculate prices
        const basePrice = BASE_PRICES[type] || 350000;
        const sizeMultiplier = SIZE_MULTIPLIERS[size] || 1;
        const totalPrice = Math.round(basePrice * sizeMultiplier);
        const depositAmount = Math.round(totalPrice * 0.5); // 50% deposit

        // Generate codes (8-HEX format)
        const orderCode = generateId.order();
        const cartCode = generateId.cart();
        const itemOrderCode = generateId.order();
        const fullCode = `${cartCode}_${itemOrderCode}`;

        console.log('[Custom Order API] Creating order with unified schema...');
        console.log('[Custom Order API] Codes:', { orderCode, cartCode, itemOrderCode, fullCode });

        // Insert into unified orders table
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                order_code: orderCode,
                cart_code: cartCode,
                user_id: userId,
                order_type: 'custom',
                subtotal: totalPrice,
                shipping_fee: 0,
                discount: 0,
                total_amount: totalPrice,
                deposit_amount: depositAmount,
                deposit_paid: false,
                status: 'pending',
                payment_status: 'pending',
                fulfillment_status: 'pending',
                shipping_address: {
                    full_name: shippingAddress.full_name,
                    phone: shippingAddress.phone,
                    address_line: shippingAddress.address_line || '',
                    ward: shippingAddress.ward || '',
                    district: shippingAddress.district || '',
                    province: shippingAddress.province,
                },
                notes: notes || null,
            })
            .select()
            .single();

        if (orderError) {
            console.error('[Custom Order API] Create order error:', orderError);
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'DB_ERROR',
                        message: orderError.message || 'Unknown database error'
                    }
                },
                { status: 500 }
            );
        }

        if (!order) {
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: 'Order creation failed' } },
                { status: 500 }
            );
        }

        // Insert order item for custom figurine
        const { data: orderItem, error: itemError } = await supabase
            .from('order_items')
            .insert({
                order_id: order.id,
                cart_code: cartCode,
                item_order_code: itemOrderCode,
                full_code: fullCode,
                item_type: 'custom',
                custom_type: type,
                custom_size: size,
                name: `Custom Figurine - ${type.charAt(0).toUpperCase() + type.slice(1)} (${size})`,
                quantity: 1,
                unit_price: totalPrice,
                total_price: totalPrice,
                production_status: 'waiting',
                configuration: {
                    type,
                    size,
                    images: images || [],
                    notes: notes || null,
                },
            })
            .select()
            .single();

        if (itemError) {
            console.error('[Custom Order API] Create order item error:', itemError);
            // Rollback: delete the order
            await supabase.from('orders').delete().eq('id', order.id);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: itemError.message } },
                { status: 500 }
            );
        }

        // Link uploaded files to order_files
        if (images && images.length > 0) {
            try {
                // Update any existing order_files with this cart_code
                await supabase
                    .from('order_files')
                    .update({
                        order_id: order.id,
                        order_item_id: orderItem?.id,
                        order_code: orderCode,
                    })
                    .eq('cart_code', cartCode);
            } catch (err) {
                console.warn('[Custom Order API] Failed to link order_files:', err);
            }
        }

        // Return success response
        return NextResponse.json({
            success: true,
            data: {
                id: order.id,
                order_code: order.order_code,
                cart_code: order.cart_code,
                total: order.total_amount,
                deposit_amount: order.deposit_amount,
                status: order.status,
            },
        });
    } catch (error) {
        console.error('[Custom Order API] Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
            { status: 500 }
        );
    }
}
