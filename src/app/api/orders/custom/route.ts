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

        // FAILSAFE STRATEGY for Persistent Schema Cache Errors:
        // 1. Do NOT use RPC (functions are not found in cache)
        // 2. Do NOT insert into new columns like 'admin_note', 'customer_note', 'custom_config'
        // 3. Embed metadata into 'shipping_address' (JSONB) which is a stable column

        // NUCLEAR OPTION: Direct Postgres Connection via 'pg' driver
        // Bypasses Supabase PostgREST API entirely (eliminates Schema Cache issues)
        console.log('[Custom Order API] Executing DIRECT SQL via pg driver...');

        const safeShippingAddress = JSON.stringify({
            full_name: shippingAddress.full_name,
            phone: shippingAddress.phone,
            address_line: shippingAddress.address_line || '',
            ward: shippingAddress.ward || '',
            district: shippingAddress.district || '',
            province: shippingAddress.province,
            _metadata: {
                customer_note: notes,
                admin_note: notes ? `[User Note]: ${notes}` : null,
                custom_config: { type, size },
                intended_order_type: 'custom'
            }
        });

        const insertQuery = `
            INSERT INTO orders (
                order_code,
                user_id,
                subtotal,
                shipping_fee,
                total,
                deposit_amount,
                shipping_address,
                status,
                order_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
            RETURNING *;
        `;

        const values = [
            orderCode,
            userId,
            totalPrice,
            0,
            totalPrice,
            depositAmount,
            safeShippingAddress,
            'pending', // Explicitly setting status to ensure it works
            'custom'   // Explicitly setting order_type
        ];

        let order;
        try {
            const result = await dbRequest.query(insertQuery, values);
            order = result.rows[0];
            console.log('[Custom Order API] Direct SQL Success:', order.id);
        } catch (dbError: any) {
            console.error('[Custom Order API] Direct SQL Error:', dbError);
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'DB_DIRECT_ERROR',
                        message: dbError.message || 'Database connection failed'
                    }
                },
                { status: 500 }
            );
        }
        // Legacy Supabase error handling removed as we use try/catch block above
        const orderError = null;



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
