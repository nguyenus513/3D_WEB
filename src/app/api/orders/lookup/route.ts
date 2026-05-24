/**
 * Single Order Lookup API
 * GET /api/orders/lookup?id=xxx
 * 
 * Searches unified orders table to find a specific order
 * Used by checkout success page to display QR
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';
import { getBankConfigForOrderTypeAsync } from '@/lib/vietqr';
import { createLogger } from '@/lib/logger';

const log = createLogger('order-lookup');

function getObjectIdTimestamp(value: unknown): string | null {
    const text = typeof value === 'string' ? value : '';
    if (!/^[a-fA-F0-9]{24}$/.test(text)) return null;
    const seconds = parseInt(text.slice(0, 8), 16);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return new Date(seconds * 1000).toISOString();
}

function resolveOrderDate(order: any, items: any[] = []): string {
    const itemDates = items
        .map((item: any) => item.created_at || item.updated_at)
        .filter(Boolean)
        .sort();

    return order.created_at
        || order.updated_at
        || order.paid_at
        || order.confirmed_at
        || itemDates[0]
        || getObjectIdTimestamp(order.id)
        || new Date().toISOString();
}

const supabaseAdmin = getAdminSupabase();

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
        // Actual order_items columns: id, order_id, product_id, item_code, full_code, name, sku, quantity, unit_price, item_type, production_status, created_at, total_price
        // print_jobs columns: id, order_item_id, material, color, infill, layer_height, estimated_hours, estimated_grams, status
        const ORDER_SELECT = `*, items:order_items(*, print_job:print_jobs(*))`;
        let order = null;

        // 1. Try by order_code
        const { data: orderByCode } = await supabaseAdmin
            .from('orders')
            .select(ORDER_SELECT)
            .eq('user_id', userId)
            .eq('order_code', orderId)
            .maybeSingle();

        if (orderByCode) {
            order = orderByCode;
            log.debug('Found by order_code');
        }

        // 2. Try by id (UUID)
        if (!order) {
            const { data: orderById } = await supabaseAdmin
                .from('orders')
                .select(ORDER_SELECT)
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

        const orderItems = order.items || [];

        const toAmount = (value: unknown): number => {
            const amount = Number(value ?? 0);
            return Number.isFinite(amount) && amount > 0 ? amount : 0;
        };

        const calculateItemsTotal = (items: any[]): number => items.reduce((sum, item) => {
            const itemTotal = toAmount(item.total_price);
            if (itemTotal > 0) return sum + itemTotal;
            return sum + toAmount(item.unit_price) * Math.max(1, Number(item.quantity || 1));
        }, 0);

        // Calculate totals; repair legacy/partial Mongo rows where total_amount is 0/missing.
        const storedTotal = toAmount(order.total_amount) || toAmount(order.total) || toAmount(order.subtotal);
        const itemsTotal = calculateItemsTotal(orderItems);
        const total = storedTotal || itemsTotal;

        // Calculate deposit based on order type
        // Rules: 
        // - printing = 100%
        // - ready_made/product = 100%  
        // - custom = 50%
        // - mixed = 50% of custom items + 100% of print/product items
        const getDepositAmount = (orderType: string, total: number, items: any[]): number => {
            // If already stored, use that
            const storedDeposit = toAmount(order.deposit_amount);
            if (storedDeposit > 0) return storedDeposit;

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

        if ((toAmount(order.total_amount) === 0 || toAmount(order.deposit_amount) === 0) && total > 0) {
            supabaseAdmin
                .from('orders')
                .update({ total_amount: total, deposit_amount: depositAmount })
                .eq('id', order.id)
                .then(({ error }) => {
                    if (error) log.warn('Lazy total repair failed', { orderId: order.id, error: error.message });
                });
        }

        // Map canonical DB order_type to payment_configs order_type
        // payment_configs uses: 'printing', 'ready_made', 'custom'
        // DB orders uses:       'print_3d', 'product', 'custom'
        const toPaymentOrderType = (type: string): 'printing' | 'ready_made' | 'custom' => {
            switch (type) {
                case 'print_3d': return 'printing';
                case 'product': return 'ready_made';
                case 'custom': return 'custom';
                default: return 'ready_made';
            }
        };
        const bankConfig = await getBankConfigForOrderTypeAsync(toPaymentOrderType(orderType));

        // Get customer_code from profiles table
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('customer_code')
            .eq('id', userId)
            .single();

        const customerCode = profile?.customer_code || userId.replace(/-/g, '').substring(0, 10).toUpperCase();
        const orderCode = order.order_code || orderId;
        const transferContent = `${customerCode}_${orderCode}`;
        const qrUrl = `https://img.vietqr.io/image/${bankConfig.bankId}-${bankConfig.accountNo}-compact2.png?amount=${depositAmount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bankConfig.accountName)}`;

        // Normalize items for response
        // order_items columns: id, order_id, product_id, item_code, full_code, name, sku, quantity, unit_price, item_type, production_status, created_at, total_price
        // print_jobs (joined as print_job): material, color, infill, layer_height, estimated_hours, estimated_grams, status
        const items = (order.items || []).map((item: any) => {
            // print_job is an array from PostgREST join, take first entry
            const pj = Array.isArray(item.print_job) ? item.print_job[0] : item.print_job;
            const quantity = Number(item.quantity || 1);
            const unitPrice = Number(item.unit_price || 0);
            const itemTotal = Number(item.total_price || unitPrice * quantity || 0);
            return {
                id: item.id,
                name: item.name,
                product_name: item.name,
                product_sku: item.sku,
                quantity,
                unit_price: unitPrice,
                total_price: itemTotal,
                item_order_code: item.item_code,
                cart_order_code: item.full_code || null,
                production_status: item.production_status,
                item_type: item.item_type,
                is_custom: item.item_type === 'custom',
                // Print specifications from print_jobs table
                print_config: pj ? {
                    material: pj.material,
                    color: pj.color,
                    infill: pj.infill,
                    layer_height: pj.layer_height,
                    estimated_grams: pj.estimated_grams,
                    estimated_hours: pj.estimated_hours,
                    print_status: pj.status,
                } : null,
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                id: order.id,
                order_code: order.order_code,
                cart_code: order.cart_code,
                order_type: orderType,
                total,
                deposit_amount: depositAmount,
                status: order.status,
                payment_status: order.payment_status || 'pending',
                fulfillment_status: order.fulfillment_status || 'pending',
                shipping_address: order.shipping_address || order.shipping_address_snapshot || null,
                shipping_code: order.shipping_code || null,
                created_at: resolveOrderDate(order, items),
                approved_at: order.approved_at || null,
                // Demo / review fields
                demo_images: order.demo_images || [],
                demo_image_url: order.demo_image_url || null,
                finished_images: order.finished_images || [],
                revision_count: order.revision_count || 0,
                revision_feedback: order.revision_feedback || null,
                // Config fields
                custom_config: order.custom_config || null,
                printing_config: order.printing_config || null,
                items: items,
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
