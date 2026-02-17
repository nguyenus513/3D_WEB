/**
 * Single Order Lookup API
 * GET /api/orders/lookup?id=xxx
 * 
 * Searches unified orders table to find a specific order
 * Used by checkout success page to display QR
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';
import { getProfileId } from '@/lib/utils/getProfileId';
import { getBankConfigForOrderTypeAsync } from '@/lib/vietqr';
import { createLogger } from '@/lib/logger';

const log = createLogger('order-lookup');

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getProfileId(session.user, supabaseAdmin);
        if (!userId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get('id');

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
        }

        log.debug('Searching for order', { orderId, userId });

        // Search in unified orders table by multiple fields
        let order = null;

        // 1. Try by order_code
        const { data: orderByCode } = await supabaseAdmin
            .from('orders')
            .select(`
                *,
                items:order_items(*, print_config:order_item_print_configs(*))
            `)
            .eq('user_id', userId)
            .eq('order_code', orderId)
            .maybeSingle();

        if (orderByCode) {
            order = orderByCode;
            log.debug('Found by order_code');
        }

        // 2. Try by cart_code
        if (!order) {
            const { data: orderByCart } = await supabaseAdmin
                .from('orders')
                .select(`*, items:order_items(*, print_config:order_item_print_configs(*))`)
                .eq('user_id', userId)
                .eq('cart_code', orderId)
                .maybeSingle();

            if (orderByCart) {
                order = orderByCart;
                log.debug('Found by cart_code');
            }
        }

        // 3. Try by id (UUID)
        if (!order) {
            const { data: orderById } = await supabaseAdmin
                .from('orders')
                .select(`*, items:order_items(*, print_config:order_item_print_configs(*))`)
                .eq('user_id', userId)
                .eq('id', orderId)
                .maybeSingle();

            if (orderById) {
                order = orderById;
                log.debug('Found by id');
            }
        }

        if (!order) {
            log.info('Order not found', { orderId });
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Determine order type
        const orderType = order.order_type || 'ready_made';

        // Calculate totals
        const total = order.total_amount || 0;
        const orderItems = order.items || [];

        // Calculate deposit based on order type
        // Rules: 
        // - printing = 100%
        // - ready_made/product = 100%  
        // - custom = 50%
        // - mixed = 50% of custom items + 100% of print/product items
        const getDepositAmount = (orderType: string, total: number, items: any[]): number => {
            // If already stored, use that
            if (order.deposit_amount) return order.deposit_amount;

            // Custom only: 50%
            if (orderType === 'custom') {
                return Math.round(total * 0.5);
            }

            // Mixed: calculate per-item
            if (orderType === 'mixed' && items.length > 0) {
                let depositTotal = 0;
                for (const item of items) {
                    const itemPrice = item.total_price || (item.unit_price || 0) * (item.quantity || 1);
                    const itemType = item.item_type || 'ready_made';

                    if (itemType === 'custom') {
                        depositTotal += Math.round(itemPrice * 0.5);
                    } else {
                        depositTotal += itemPrice;
                    }
                }
                return depositTotal;
            }

            // printing, ready_made, product: 100%
            return total;
        };
        const depositAmount = getDepositAmount(orderType, total, orderItems);

        // Generate QR info
        const bankConfig = await getBankConfigForOrderTypeAsync(orderType);

        // Get customer_code from profiles table
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('customer_code')
            .eq('id', userId)
            .single();

        const customerCode = profile?.customer_code || userId.replace(/-/g, '').substring(0, 10).toUpperCase();
        const orderCode = order.order_code || order.cart_code || orderId;
        const transferContent = `${customerCode}_${orderCode}`;
        const qrUrl = `https://img.vietqr.io/image/${bankConfig.bankId}-${bankConfig.accountNo}-compact2.png?amount=${depositAmount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bankConfig.accountName)}`;

        // Normalize items for response - include all fields needed for UI
        const items = (order.items || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            product_name: item.name, // Alias for compatibility
            product_sku: item.sku,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            item_order_code: item.item_code, // DB uses item_code
            cart_order_code: item.full_code || (order.cart_code && item.item_code
                ? `${order.cart_code}_${item.item_code}`
                : null), // Full format: CARTCODE_ORDERCODE
            production_status: item.production_status,
            status: item.status,
            // DB uses 'spec' column, not 'configuration' - merge with fallbacks
            configuration: {
                ...(item.spec || {}),
                // Prefer relational print_config table over spec JSON
                color: item.print_config?.color || item.spec?.color || item.color,
                material: item.print_config?.material || item.spec?.material || item.material,
                custom_type: item.spec?.custom_type || item.custom_type,
                custom_size: item.spec?.custom_size || item.custom_size,
                size: item.spec?.size || item.custom_size,
                // Print-specific: prefer print_config table
                type: item.print_config?.print_tech || item.spec?.type || item.spec?.printOptions?.type,
                infill: item.print_config?.infill || item.spec?.infill || item.spec?.printOptions?.infill,
                layerHeight: item.print_config?.layer_height || item.spec?.layerHeight || item.spec?.printOptions?.layerHeight,
                fileName: item.spec?.fileName || item.spec?.file_name,
                grams: item.print_config?.estimated_grams || item.spec?.grams,
                hours: item.print_config?.estimated_hours || item.spec?.hours,
                volume: item.print_config?.volume || item.spec?.volume,
            },
            item_type: item.item_type,
            custom_type: item.custom_type,
            custom_size: item.custom_size,
            color: item.color,
            material: item.material,
            notes: item.notes,
            // Custom order fields
            is_custom: item.item_type === 'custom' || item.is_custom,
            custom_note: item.custom_note || item.notes,
            preview_images: item.preview_images || [],
            preview_status: item.preview_status,
        }));

        // Virtual Status Logic: If demo exists but status is stuck, override to 'review'
        let finalStatus = order.status;
        const demoUrl = order.demo_images?.[0]?.url;
        if (demoUrl && ['pending', 'confirmed', 'designing'].includes(finalStatus)) {
            finalStatus = 'review';
        }

        return NextResponse.json({
            success: true,
            data: {
                id: order.id,
                order_code: order.order_code,
                cart_code: order.cart_code,
                order_type: orderType,
                total,
                deposit_amount: depositAmount,
                deposit_paid: order.deposit_paid || false,
                status: finalStatus,
                payment_status: order.payment_status || 'pending',
                fulfillment_status: order.fulfillment_status || 'pending',
                shipping_address: order.shipping_address || order.shipping_address_snapshot,
                created_at: order.created_at,
                items: items,
                demo_images: order.demo_images || [],
                finished_images: order.finished_images || [],
                revision_count: order.revision_count || 0,
                revision_feedback: order.revision_feedback || null,
                approved_at: order.approved_at || null,
                payment: {
                    bank_id: bankConfig.bankId,
                    account_no: bankConfig.accountNo,
                    account_name: bankConfig.accountName,
                    transfer_content: transferContent,
                    qr_url: qrUrl,
                },
            },
        });
    } catch (error) {
        log.error('Order lookup failed', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
