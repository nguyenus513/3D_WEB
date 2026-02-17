
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { stripHtml } from '@/lib/security/sanitize';
import { generateId } from '@/lib/generateId';

// Types from client-side
interface FileInfo {
    id: string;
    name: string;
    size?: number;
}

interface PrintItemAnalysis {
    volume: number;
    grams: number;
    hours: number;
    price: number;
}

interface PrintItem {
    quantity: number;
    analysis: PrintItemAnalysis;
}

interface CreatePrintingOrderRequest {
    items: PrintItem[];
    files: FileInfo[];
    type: 'fdm' | 'resin';
    color: string;
    infill: string;
    layerHeight: string;
    notes: string;
    shippingAddress: {
        full_name: string;
        phone: string;
        address_line: string;
        ward: string;
        district: string;
        province: string;
    };
    totalPrice: number;
}

export async function POST(request: NextRequest) {
    try {
        // verify session
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body: CreatePrintingOrderRequest = await request.json();
        const { items, files, type, color, infill, layerHeight, notes, shippingAddress, totalPrice } = body;

        const supabase = getAdminSupabase();

        // Get user profile
        const { data: user, error: userError } = await supabase
            .from('profiles')
            .select('id, customer_code')
            .eq('email', session.user.email)
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Generate ID
        const orderCode = generateId.printing();

        // Sanitize notes
        const customerNote = notes ? stripHtml(notes).slice(0, 1000) : null;

        // Construct consolidated customer note
        const itemsNote = files.map((f, i) => {
            const item = items[i];
            return `${f.name} x${item.quantity}`;
        }).join('\n');

        const settingsNote = type === 'fdm'
            ? `Infill: ${infill} | Layer: ${layerHeight}mm`
            : '';

        const fullNote = [settingsNote, itemsNote, customerNote].filter(Boolean).join('\n');

        // Create Order (ĐƠN TỔNG)
        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .insert({
                order_code: orderCode,
                user_id: user.id,
                order_type: 'print_3d',
                status: 'pending',
                payment_status: 'pending',
                subtotal: totalPrice,
                discount: 0,
                total_amount: totalPrice,
                deposit_amount: totalPrice,
                deposit_paid: false,
                customer_note: fullNote,
                shipping_address: shippingAddress,
            })
            .select()
            .single();


        if (orderError) {
            console.error('Printing Order Insert Error:', orderError);
            return NextResponse.json({ error: orderError.message }, { status: 500 });
        }


        // cartCode already defined above when creating order
        // Insert order_items (ĐƠN CON - one per file) - NEW SCHEMA
        const orderItemInserts = items.map((item, index) => {
            const file = files[index];
            const itemCode = generateId.order(); // 8 char HEX
            const fullCode = `${orderCode}_${itemCode}`; // ORDER_ITEM format

            return {
                order_id: orderData.id,
                product_id: null, // No product for 3D printing
                item_code: itemCode,
                full_code: fullCode,
                name: file?.name || `3D Print ${index + 1}`,
                quantity: item.quantity,
                unit_price: item.analysis.price,
                total_price: item.analysis.price * item.quantity,
                item_type: 'print_3d',
                production_status: 'waiting',
                // Minimal spec — print config lives in order_item_print_configs
                spec: {},
            };
        });

        const { data: insertedItems, error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItemInserts)
            .select();

        if (itemsError) {
            console.error('Order items insert error:', itemsError);
            return NextResponse.json({ error: 'Failed to create order items' }, { status: 500 });
        }

        // Insert print configs (1:1 with order_items)
        if (insertedItems && insertedItems.length > 0) {
            const printConfigInserts = insertedItems.map((item, index) => ({
                order_item_id: item.id,
                print_tech: type,
                material: type === 'resin' ? 'standard_resin' : 'petg',
                color: color,
                // FDM-only fields: infill and layer_height are irrelevant for SLA/Resin
                infill: type === 'fdm' ? infill : null,
                layer_height: type === 'fdm' ? layerHeight : null,
                estimated_grams: items[index].analysis.grams,
                estimated_hours: items[index].analysis.hours,
                volume: items[index].analysis.volume,
            }));

            const { error: configError } = await supabase
                .from('order_item_print_configs')
                .insert(printConfigInserts);

            if (configError) {
                console.error('[PrintingOrder] Failed to insert print configs:', configError);
                // Non-fatal: order still exists, config can be backfilled
            }
        }
        // Link existing order_files to this order
        // UploadService already created order_files records during upload.
        // Here we UPDATE them to set order_id and order_item_id.
        // If no record exists (e.g., insertOrderFile failed), INSERT as fallback.
        if (files && files.length > 0) {
            for (const [idx, f] of files.entries()) {
                const linkedItem = insertedItems?.[idx];
                const { data: updatedRows, error: fileError } = await supabase
                    .from('order_files')
                    .update({
                        order_id: orderData.id,
                        order_item_id: linkedItem?.id || null,
                    })
                    .eq('file_key', f.id)
                    .select('id');

                if (fileError) {
                    console.error(`[PrintingOrder] Failed to link order_file (key=${f.id}):`, fileError);
                }

                // Fallback: INSERT if no existing record was updated
                if (!fileError && (!updatedRows || updatedRows.length === 0)) {
                    console.warn(`[PrintingOrder] No existing order_file for key=${f.id}, inserting new record`);
                    const ext = f.name?.split('.').pop()?.toLowerCase() || null;
                    const { error: insertError } = await supabase
                        .from('order_files')
                        .insert({
                            order_id: orderData.id,
                            order_item_id: linkedItem?.id || null,
                            file_key: f.id,
                            file_name: f.name || `file_${idx + 1}`,
                            file_type: ext,
                            file_url: `/api/files/${f.id}`,
                            mime_type: 'application/octet-stream',
                            size_bytes: f.size || null,
                            storage_provider: 'r2',
                            category: 'models',
                        });

                    if (insertError) {
                        console.error(`[PrintingOrder] Fallback INSERT failed (key=${f.id}):`, insertError);
                    }
                }
            }
        }

        return NextResponse.json({ success: true, orderId: orderData.id });

    } catch (error: any) {
        console.error('Create printing order API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
