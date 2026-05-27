/**
 * User Orders API - Compatible with existing schema
 * GET /api/orders/my-orders
 * 
 * Uses ONLY columns that exist in the current orders table
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';
import { getMongoCollections } from '@/lib/mongodb';

const supabaseAdmin = getAdminSupabase();

function firstImageUrl(images: unknown): string | null {
    if (!Array.isArray(images)) return null;
    for (const image of images) {
        if (typeof image === 'string' && image) return image;
        if (image && typeof image === 'object') {
            const item = image as Record<string, unknown>;
            const url = item.url || item.src || item.image_url || item.file_url || item.thumbnail;
            if (typeof url === 'string' && url) return url;
        }
    }
    return null;
}

function compactText(value: unknown, fallback: string, max = 32): string {
    const text = typeof value === 'string' && value.trim() ? value.trim() : fallback;
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function firstModelImage(config: any): string | null {
    const modelImages = Array.isArray(config?.modelImages) ? config.modelImages : [];
    for (const image of modelImages) {
        const url = image?.url || image?.thumbnail || image?.generatedModelImage?.url;
        if (typeof url === 'string' && url) return url;
    }
    const drafts = Array.isArray(config?.modelImageDrafts) ? config.modelImageDrafts : [];
    for (const draft of drafts) {
        const url = draft?.generatedModelImage?.url || draft?.previewUrl;
        if (typeof url === 'string' && url) return url;
    }
    return null;
}

function buildOrderSummary(order: any, items: any[], productName?: string | null): string {
    const type = order.order_type || items[0]?.item_type || 'product';
    if (type === 'custom') {
        const config = order.custom_config || items[0]?.configuration || {};
        const size = config?.size ? ` size ${config.size}` : '';
        return compactText(`Mô hình custom${size}`, 'Mô hình custom');
    }
    if (type === 'printing' || type === 'print_3d') {
        const config = order.printing_config || items[0]?.configuration || {};
        const printType = config?.type || config?.tech || items[0]?.name;
        return compactText(printType ? `File in 3D ${printType}` : 'File in 3D', 'File in 3D');
    }
    return compactText(productName || items[0]?.name, 'Sản phẩm');
}


function getObjectIdTimestamp(value: unknown): string | null {
    const text = typeof value === 'string' ? value : '';
    if (!/^[a-fA-F0-9]{24}$/.test(text)) return null;
    const seconds = parseInt(text.slice(0, 8), 16);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return new Date(seconds * 1000).toISOString();
}

function resolveOrderDate(order: any): string {
    const itemDates = (order.order_items || [])
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

export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Smart profile ID lookup with email fallback
        const userId = await getProfileId(session.user, supabaseAdmin);
        if (!userId) {
            // New user with no profile yet - return empty orders instead of error
            return NextResponse.json({
                success: true,
                data: [],
                meta: { total: 0 }
            });
        }

        // Query orders with order_items - NEW SCHEMA
        const { data: orders, error } = await supabaseAdmin
            .from('orders')
            .select(`
                id, user_id, total_amount, created_at, updated_at, paid_at, confirmed_at,
                order_code, status, payment_status, order_type, custom_config, printing_config,
                order_items (
                    id, product_id, name, quantity, unit_price, total_price, configuration, 
                    item_type, production_status, item_code, full_code, created_at, updated_at
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[MyOrders] Query error:', error);
            return NextResponse.json({
                error: 'Database error',
                details: error.message
            }, { status: 500 });
        }

        const productIds = [...new Set((orders || [])
            .flatMap((order: any) => order.order_items || [])
            .map((item: any) => item.product_id)
            .filter(Boolean))].map(String);
        let productsById = new Map<string, any>();
        if (productIds.length > 0) {
            try {
                const { products } = await getMongoCollections();
                const productRows = await products.find({ _id: { $in: productIds } }).toArray();
                productsById = new Map(productRows.map((product: any) => [String(product._id), product]));
            } catch (error) {
                console.warn('[MyOrders] Product thumbnail lookup failed:', error);
            }
        }

        // Transform to response format
        const response = (orders || []).map((order: any) => {
            const rawItems = order.order_items || [];
            const firstItem = rawItems[0] || null;
            const product = firstItem?.product_id ? productsById.get(String(firstItem.product_id)) : null;
            const orderType = order.order_type || firstItem?.item_type || 'product';
            const productImage = firstImageUrl(product?.images);
            const customConfig = order.custom_config || firstItem?.configuration || {};
            const customImage = firstModelImage(customConfig) || firstImageUrl(customConfig?.images);
            const thumbnail = orderType === 'custom'
                ? customImage
                : (orderType === 'printing' || orderType === 'print_3d')
                    ? null
                    : productImage;
            const summary = buildOrderSummary(order, rawItems, product?.name || null);
            return {
                id: order.id,
                order_code: order.order_code,
                order_type: orderType,
                total_amount: order.total_amount || 0,
                status: order.status || 'pending',
                payment_status: order.payment_status || 'pending',
                created_at: resolveOrderDate(order),
                thumbnail,
                summary,
                // ALWAYS return items as array (never null/undefined)
                items: rawItems.map((item: any) => {
                    const quantity = Number(item.quantity || 1);
                    const unitPrice = Number(item.unit_price || 0);
                    const itemTotal = Number(item.total_price || unitPrice * quantity || 0);
                    return {
                        id: item.id,
                        item_code: item.item_code,
                        full_code: item.full_code,
                        product_id: item.product_id || null,
                        name: item.name || 'Sản phẩm',
                        quantity,
                        unit_price: unitPrice,
                        total_price: itemTotal,
                        item_type: item.item_type || 'product',
                        production_status: item.production_status || 'waiting',
                    };
                }),
            };
        });

        return NextResponse.json({
            success: true,
            data: response,
            meta: {
                total: response.length,
            }
        });
    } catch (error) {
        console.error('[MyOrders] Error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}



