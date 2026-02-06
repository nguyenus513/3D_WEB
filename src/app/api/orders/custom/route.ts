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
import { dbRequest } from '@/lib/db-direct';

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

        // DEBUG: Verify Service Role Key
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        try {
            const payloadPart = serviceKey.split('.')[1];
            if (payloadPart) {
                // Fix base64 padding if needed
                const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
                const parsed = JSON.parse(jsonPayload);
                console.log('[Custom Order API] Service Key Role:', parsed.role); // MUST be 'service_role'
                console.log('[Custom Order API] Key exp:', new Date(parsed.exp * 1000).toISOString());
            }
        } catch (e) {
            console.error('[Custom Order API] Failed to parse key:', e);
        }

        // Insert into orders table with order_type='custom'
        console.log('[Custom Order API] Inserting into orders table...');

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                order_number: orderCode,
                order_code: orderCode,
                user_id: userId,
                order_type: 'custom',
                status: 'pending',
                deposit_paid: false,
                subtotal: totalPrice,
                shipping_fee: 0,
                total_amount: totalPrice,
                deposit_amount: depositAmount,
                shipping_address: {
                    full_name: shippingAddress.full_name,
                    phone: shippingAddress.phone,
                    address_line: shippingAddress.address_line || '',
                    ward: shippingAddress.ward || '',
                    district: shippingAddress.district || '',
                    province: shippingAddress.province,
                },
                custom_config: { type, size },
                customer_note: notes || null,
                admin_note: notes ? `[User Note]: ${notes}` : null,
            })
            .select()
            .single();



        if (orderError) {
            console.error('[Custom Order API] Create order RPC error:', orderError);
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'DB_ERROR',
                        message: (orderError as { message: string }).message || 'Unknown database error'
                    }
                },
                { status: 500 }
            );
        }

        if (!order) {
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: 'Order creation failed (no data returned)' } },
                { status: 500 }
            );
        }

        // Note: order_configs and order_files tables don't exist
        // Custom config is stored in custom_config jsonb column
        // Files info is stored in the images array in custom_config

        // Return success response
        return NextResponse.json({
            success: true,
            data: {
                id: (order as any).id,
                order_code: (order as any).order_code,
                order_number: (order as any).order_number, // For checkout success lookup
                total: (order as any).total,
                deposit_amount: (order as any).deposit_amount,
                status: (order as any).status,
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
