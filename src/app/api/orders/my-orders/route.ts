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

const supabaseAdmin = getAdminSupabase();

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
                order_code, status, payment_status, order_type,
                order_items (
                    id, name, quantity, unit_price, total_price, 
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

        // Transform to response format
        const response = (orders || []).map((order: any) => {
            return {
                id: order.id,
                order_code: order.order_code,
                order_type: order.order_type || 'product',
                total_amount: order.total_amount || 0,
                status: order.status || 'pending',
                payment_status: order.payment_status || 'pending',
                created_at: resolveOrderDate(order),
                // ALWAYS return items as array (never null/undefined)
                items: (order.order_items || []).map((item: any) => {
                    const quantity = Number(item.quantity || 1);
                    const unitPrice = Number(item.unit_price || 0);
                    const itemTotal = Number(item.total_price || unitPrice * quantity || 0);
                    return {
                        id: item.id,
                        item_code: item.item_code,
                        full_code: item.full_code,
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



