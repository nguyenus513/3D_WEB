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

        // FAILSAFE STRATEGY for Persistent Schema Cache Errors:
        // 1. Do NOT use RPC (functions are not found in cache)
        // 2. Do NOT insert into new columns like 'admin_note', 'customer_note', 'custom_config'
        // 3. Embed metadata into 'shipping_address' (JSONB) which is a stable column

        const safeShippingAddress = {
            full_name: shippingAddress.full_name,
            phone: shippingAddress.phone,
            address_line: shippingAddress.address_line || '',
            ward: shippingAddress.ward || '',
            district: shippingAddress.district || '',
            province: shippingAddress.province,
            // Embed metadata here to survive schema cache issues
            _metadata: {
                customer_note: notes,
                admin_note: notes ? `[User Note]: ${notes}` : null,
                custom_config: { type, size },
                // Validating intent in metadata in case default is wrong
                intended_order_type: 'custom'
            }
        };

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                order_code: orderCode,
                user_id: userId,
                // order_type: 'custom', // Removed: Rely on DB DEFAULT 'custom' to bypass cache error
                // status: 'pending',    // Removed: Rely on DB DEFAULT 'pending'
                subtotal: totalPrice,
                shipping_fee: 0,
                total: totalPrice,
                deposit_amount: depositAmount,
                shipping_address: safeShippingAddress,
                // Exclude problematic columns that are not in schema cache:
                // customer_note, admin_note, custom_config, order_type
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

        // Insert order_configs record
        const { error: configError } = await supabase.from('order_configs').insert({
            order_id: (order as any).id,
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
                order_id: (order as any).id,
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
                id: (order as any).id,
                order_code: (order as any).order_code,
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
