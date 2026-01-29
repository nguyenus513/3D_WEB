/**
 * Customer Order Detail API
 * Returns order details for authenticated customer
 * Supports both order_child (new) and orders (legacy) tables
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verify session
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const supabase = getAdminSupabase();
        const userId = session.user.id;

        // Try order_child first (new system)
        const { data: childOrder, error: childError } = await supabase
            .from('order_child')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (childOrder && !childError) {
            // Return order_child format
            return NextResponse.json({
                id: childOrder.id,
                order_code: childOrder.code_child,
                order_type: childOrder.product_type,
                product_name: childOrder.product_name,
                quantity: childOrder.quantity,
                unit_price: childOrder.unit_price,
                total: childOrder.total_price,
                subtotal: childOrder.total_price,
                status: childOrder.status,
                payment_qr_url: childOrder.payment_qr_url,
                metadata: childOrder.metadata,
                created_at: childOrder.created_at,
                updated_at: childOrder.updated_at,
                source: 'order_child',
                // For display
                order_items: [{
                    id: childOrder.id,
                    name: childOrder.product_name,
                    quantity: childOrder.quantity,
                    price: childOrder.unit_price,
                    total_price: childOrder.total_price,
                }],
            });
        }

        // Fallback to legacy orders table
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (*),
                order_configs (*),
                order_files (*)
            `)
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Transform order_configs to custom_config/printing_config format
        const config = order.order_configs?.[0] || null;
        let custom_config = null;
        let printing_config = null;

        if (order.order_type === 'custom' && config) {
            custom_config = {
                type: config.custom_type || 'unknown',
                size: config.custom_size || 'Chưa chọn',
                notes: order.customer_note || '',
                images: (order.order_files || [])
                    .filter((f: { file_type: string }) => f.file_type === 'photo')
                    .map((f: { file_id: string; file_name: string | null }) => ({
                        id: f.file_id,
                        name: f.file_name || '',
                        url: `https://drive.google.com/file/d/${f.file_id}/view`,
                        thumbnail: `https://drive.google.com/thumbnail?id=${f.file_id}&sz=w400`,
                    })),
            };
        } else if (order.order_type === 'custom' && !config && order.custom_config) {
            custom_config = order.custom_config;
        }

        if (order.order_type === 'printing' && config) {
            printing_config = {
                type: config.print_tech,
                color: config.color,
                quantity: config.quantity,
                analysis: {
                    grams: config.print_weight,
                    hours: config.print_time,
                    price: order.subtotal,
                },
                notes: order.customer_note,
                files: (order.order_files || [])
                    .filter((f: { file_type: string }) => f.file_type === 'stl')
                    .map((f: { file_id: string; file_name: string | null }) => ({
                        url: `https://drive.google.com/file/d/${f.file_id}/view`,
                        name: f.file_name || 'file.stl',
                    })),
            };
        } else if (order.order_type === 'printing' && !config && order.printing_config) {
            printing_config = order.printing_config;
        }

        return NextResponse.json({
            ...order,
            custom_config,
            printing_config,
            source: 'orders',
        });
    } catch (error) {
        console.error('Customer order API error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}
