/**
 * Customer Order Detail API
 * Returns order details for authenticated customer
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
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const supabase = getAdminSupabase();

        // Get user ID from email
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', session.user.email)
            .single();

        if (!profile) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Fetch order with all related data
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (*),
                order_configs (*),
                order_files (*)
            `)
            .eq('id', id)
            .eq('user_id', profile.id)  // Ensure user owns this order
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
            // Fallback to legacy JSONB
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
            // Fallback to legacy JSONB
            printing_config = order.printing_config;
        }

        return NextResponse.json({
            ...order,
            custom_config,
            printing_config,
        });
    } catch (error) {
        console.error('Customer order API error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}
