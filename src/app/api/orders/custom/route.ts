/**
 * Custom Order Creation API - NEW SCHEMA
 * Creates custom figurine orders (single/couple/group) with file uploads
 * 
 * Uses: orders -> order_items -> order_files
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';
import { generateId } from '@/lib/generateId';
import { createLogger } from '@/lib/logger';

const log = createLogger('custom-order');

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
        size?: number;
        type?: string;
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

        // Generate codes
        const orderCode = generateId.order(); // 8 HEX

        log.info('Creating custom order', { orderCode, type, size, totalPrice });

        // Step 1: Create order (ĐƠN TỔNG)
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                order_code: orderCode,
                user_id: userId,
                order_type: 'custom',
                status: 'pending',
                payment_status: 'pending',
                subtotal: totalPrice,
                discount: 0,
                total_amount: totalPrice,
                deposit_amount: depositAmount,
                // deposit_paid removed from schema
                shipping_address_snapshot: {
                    full_name: shippingAddress.full_name,
                    phone: shippingAddress.phone,
                    address_line: shippingAddress.address_line || '',
                    ward: shippingAddress.ward || '',
                    district: shippingAddress.district || '',
                    province: shippingAddress.province,
                },
                notes: notes || null, // customer_note -> notes
            })
            .select()
            .single();

        if (orderError) {
            log.error('Create order failed', orderError);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: orderError.message } },
                { status: 500 }
            );
        }

        // Step 2: Create order_item (ĐƠN CON)
        const itemCode = generateId.order(); // 8 HEX
        const fullCode = `${orderCode}_${itemCode}`;

        const { data: orderItem, error: itemError } = await supabase
            .from('order_items')
            .insert({
                order_id: order.id,
                product_id: null,
                item_code: itemCode,
                full_code: fullCode,
                name: `Custom Figurine - ${type.charAt(0).toUpperCase() + type.slice(1)} (${size})`,
                sku: null,
                quantity: 1,
                unit_price: totalPrice,
                // total_price is GENERATED ALWAYS AS (quantity * unit_price) — do NOT insert
                item_type: 'custom',
                production_status: 'waiting',
                configuration: { // New JSONB column for custom specs
                    type: type,
                    size: size,
                    base_price: basePrice,
                    size_multiplier: sizeMultiplier,
                    notes: notes || null,
                    image_count: images?.length || 0,
                },
            })
            .select()
            .single();

        if (itemError) {
            log.error('Create order item failed', itemError);
            // Rollback order
            await supabase.from('orders').delete().eq('id', order.id);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: itemError.message } },
                { status: 500 }
            );
        }

        // Step 3: Link files to order_item via file_links
        // Files were already uploaded and stored by UploadService (POST /api/upload).
        // UploadService stored file_url as "/api/files/{key}" and linked to `order`.
        // Here we just need to re-link those files to the `order_item`.
        if (images && images.length > 0) {
            for (const img of images) {
                // img.id from frontend = R2 key (e.g. "KH-xxx/2026-02-19/xxx/xxx.jpg")
                // img.name = original filename
                const r2Key = img.id || img.name;
                if (!r2Key) continue;

                // Find existing file record by matching file_url patterns:
                // UploadService stores as "/api/files/{key}"
                // Also check for raw key in case of older records
                const proxyPath = `/api/files/${r2Key}`;
                const { data: existingFile } = await supabase
                    .from('files')
                    .select('id')
                    .or(`file_url.eq.${proxyPath},file_url.eq.${r2Key}`)
                    .maybeSingle();

                if (existingFile) {
                    // Link existing file to order_item
                    const { error: linkError } = await supabase
                        .from('file_links')
                        .insert({
                            file_id: existingFile.id,
                            ref_type: 'order_item',
                            ref_id: orderItem.id,
                            tag: 'reference',
                        });

                    if (linkError) {
                        log.warn('Failed to link file to order_item', { error: linkError, fileId: existingFile.id });
                    }
                } else {
                    log.warn('File record not found for R2 key', { r2Key, proxyPath });
                }
            }
        }

        // Return success response
        return NextResponse.json({
            success: true,
            data: {
                id: order.id,
                order_code: order.order_code,
                item_code: itemCode,
                full_code: fullCode,
                total: order.total_amount,
                deposit_amount: order.deposit_amount,
                status: order.status,
            },
        });
    } catch (error: any) {
        log.error('Unexpected error', error);
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
            { status: 500 }
        );
    }
}
