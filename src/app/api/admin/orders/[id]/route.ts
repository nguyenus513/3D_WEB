/**
 * Admin Orders API
 * Secure admin-only operations for order management
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-guard';
import { getAdminSupabase } from '@/lib/supabase/admin';

// PUT /api/admin/orders/[id] - Update order (admin only)
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verify admin
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
        }

        const body = await request.json();
        const supabase = getAdminSupabase();

        // Verify order exists
        const { data: order } = await supabase
            .from('orders')
            .select('id, status')
            .eq('id', id)
            .single();

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Build safe update object
        const updates: Record<string, unknown> = {};

        // Allowed fields
        if (body.status) {
            const validStatuses = [
                'pending', 'expired', 'paid', 'confirmed', 'preparing', 'processing',
                'designing', 'review', 'revising', 'approved', 'producing',
                'printing', 'completed', 'shipped', 'shipping',
                'delivered', 'cancelled', 'refunded'
            ];
            if (validStatuses.includes(body.status)) {
                updates.status = body.status;

                // Auto-set timestamps
                const now = new Date().toISOString();
                if (body.status === 'paid' || body.status === 'confirmed') updates.paid_at = now;
                if (body.status === 'preparing' || body.status === 'processing') updates.processing_at = now;
                if (body.status === 'designing') updates.designing_at = now;
                if (body.status === 'review') updates.review_at = now;
                if (body.status === 'revising') updates.revising_at = now;
                if (body.status === 'approved') updates.approved_at = now;
                if (body.status === 'producing') updates.producing_at = now;
                if (body.status === 'printing') updates.printing_at = now;
                if (body.status === 'shipped' || body.status === 'shipping') updates.shipped_at = now;
                if (body.status === 'delivered') updates.delivered_at = now;
            }
        }

        if (body.admin_note !== undefined) {
            updates.admin_note = body.admin_note?.slice(0, 500) || null;
        }

        if (body.shipping_code !== undefined) {
            updates.shipping_code = body.shipping_code?.slice(0, 30) || null;
        }

        if (body.shipping_status !== undefined) {
            updates.shipping_status = body.shipping_status?.slice(0, 20) || null;
        }

        updates.updated_at = new Date().toISOString();

        const { error } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error('Update order error:', error);
            return NextResponse.json({ error: 'Không thể cập nhật đơn hàng' }, { status: 500 });
        }

        // AUTO-MIGRATION HOOK
        // If order is completed/delivered, migrate R2 files to Google Drive (Archive)
        if (body.status === 'delivered' || body.status === 'completed') {
            console.log(`[Hook] Order ${id} ${body.status} - triggering migration...`);

            // Execute migration (non-blocking or blocking depending on preference)
            // We await here to ensure it starts, but catch errors to not break response
            try {
                const { migrateOrderToArchive } = await import('@/lib/storage');
                const result = await migrateOrderToArchive(id);
                console.log('[Hook] Migration result:', result);
            } catch (migError) {
                console.error('[Hook] Migration failed:', migError);
                // Don't fail the request, just log
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Admin orders API error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}

// GET /api/admin/orders/[id] - Get order details (already exists, kept for reference)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { authorized, response } = await requireAdmin(request);
        if (!authorized) return response;

        const { id } = await params;
        const supabase = getAdminSupabase();

        // Get order with all related data (normalized tables)
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                *,
                profiles:user_id (id, full_name, email, phone, customer_code),
                order_items (*),
                order_configs (*),
                order_files (*),
                addresses:shipping_address_id (*)
            `)
            .eq('id', id)
            .single();

        if (error || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Map order_configs to legacy format for backward compatibility
        const config = order.order_configs?.[0] || null;
        let custom_config = null;
        let printing_config = null;

        if (order.order_type === 'custom' && config) {
            custom_config = {
                type: config.custom_type,
                size: config.custom_size,
                notes: order.customer_note,
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
            // Fallback to legacy JSONB for orders created before migration
            custom_config = order.custom_config;
        } else if (order.order_type === 'printing' && config) {
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

        // Map shipping_address from addresses table or fallback to JSONB
        const shippingAddress = order.addresses || order.shipping_address || null;

        return NextResponse.json({
            order: {
                ...order,
                custom_config,
                printing_config,
                shipping_address: shippingAddress,
            },
            profile: order.profiles,
        });
    } catch (error) {
        console.error('Get order error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}
