/**
 * Custom Order Creation API
 * Creates custom orders (single/couple/group) with file uploads
 * Uses supabaseAdmin to bypass RLS policies
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

        // Generate order code
        const orderCode = generateId.custom();

        // Create order in database
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                order_code: orderCode,
                user_id: userId,
                order_type: 'custom',
                status: 'pending',
                subtotal: totalPrice,
                shipping_fee: 0,
                total: totalPrice,
                deposit_amount: depositAmount,
                customer_note: notes || null,
                shipping_address: {
                    full_name: shippingAddress.full_name,
                    phone: shippingAddress.phone,
                    address_line: shippingAddress.address_line || '',
                    ward: shippingAddress.ward || '',
                    district: shippingAddress.district || '',
                    province: shippingAddress.province,
                },
                custom_config: {
                    type: type,
                    size: size,
                },
            })
            .select()
            .single();

        if (orderError) {
            console.error('[Custom Order API] Create order error:', orderError);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: orderError.message } },
                { status: 500 }
            );
        }

        // Insert order_configs record
        const { error: configError } = await supabase.from('order_configs').insert({
            order_id: order.id,
            custom_type: type,
            custom_size: size,
        });

        if (configError) {
            console.error('[Custom Order API] Create config error:', configError);
            // Non-fatal, continue
        }

        // Insert order_files records if images provided
        if (images && images.length > 0) {
            const orderFiles = images.map((img) => ({
                order_id: order.id,
                file_id: img.id,
                file_type: 'photo',
                file_name: img.name || null,
            }));

            const { error: filesError } = await supabase.from('order_files').insert(orderFiles);

            if (filesError) {
                console.error('[Custom Order API] Create files error:', filesError);
                // Non-fatal, continue
            }
        }

        // Return success response
        return NextResponse.json({
            success: true,
            data: {
                id: order.id,
                order_code: order.order_code,
                total: order.total,
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
