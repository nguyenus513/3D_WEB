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
import { stripHtml } from '@/lib/security/sanitize';
import { requireCsrf } from '@/lib/security/csrf';
import { fetchCustomPricing, calculateCustomPrice } from '@/lib/services/pricingService';

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
        key: string;
        name: string;
    }>;
}


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

        const csrf = await requireCsrf(request);
        if (!csrf.valid) {
            return csrf.error!;
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
        const sanitizedNotes = notes ? stripHtml(notes).slice(0, 500) : null;

        // Validate required fields
        if (!type || !shippingAddress?.full_name || !shippingAddress?.phone || !shippingAddress?.province) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
                { status: 400 }
            );
        }

        const pricing = await fetchCustomPricing();
        const typeRow = pricing.types.find((t) => t.type === type);
        const sizeRow = pricing.sizes.find((s) => s.size_code === size);
        if (!typeRow || !sizeRow) {
            return NextResponse.json(
                { success: false, error: { code: 'PRICING_NOT_FOUND', message: 'Pricing not configured' } },
                { status: 400 }
            );
        }

        const priceResult = calculateCustomPrice(pricing, type, size);
        const totalPrice = priceResult.total;
        const depositAmount = priceResult.depositAmount;

        // Generate order code
        const orderCode = generateId.custom();

        // UNIFIED TABLE STRATEGY: Insert into 'orders' table

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                order_code: orderCode,
                user_id: userId,
                order_type: 'custom',
                status: 'pending',
                payment_status: 'pending',
                subtotal: totalPrice,
                shipping_fee: 0,
                total_amount: totalPrice,
                deposit_amount: depositAmount,
                shipping_address_snapshot: {
                    full_name: shippingAddress.full_name,
                    phone: shippingAddress.phone,
                    address_line: shippingAddress.address_line || '',
                    ward: shippingAddress.ward || '',
                    district: shippingAddress.district || '',
                    province: shippingAddress.province,
                },
                custom_config: {
                    type,
                    size,
                    image_keys: (images || []).map((img) => ({ key: img.key, name: img.name })),
                },
                items_config: {
                    custom: { type, size }
                },
                notes: sanitizedNotes,
                admin_notes: sanitizedNotes ? `[User Note]: ${sanitizedNotes}` : null,
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

        // Attach uploaded files to this order (order_files)
        if (images && images.length > 0) {
            await supabase
                .from('order_files')
                .update({
                    order_id: (order as any).id,
                    order_code: (order as any).order_code,
                })
                .eq('order_code', (order as any).order_code)
                .is('order_id', null)
                .eq('owner_id', userId);
        }

        // Insert a normalized order item for consistent UI (optional but recommended)
        await supabase.from('order_items').insert({
            order_id: (order as any).id,
            product_id: null,
            name: `Custom ${type.toUpperCase()}`,
            sku: null,
            quantity: 1,
            unit_price: totalPrice,
            total_price: totalPrice,
            configuration: { type, size },
        });

        // Return success response
        return NextResponse.json({
            success: true,
            data: {
                id: (order as any).id,
                order_code: (order as any).order_code,
                order_number: (order as any).order_number,
                total: (order as any).total_amount ?? (order as any).total,
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
