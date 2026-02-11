
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { stripHtml } from '@/lib/security/sanitize';
import { generateId } from '@/lib/generateId';

// Types from client-side
interface FileInfo {
    id: string;
    name: string;
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
                shipping_fee: 0,
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
                // All config in spec JSONB
                spec: {
                    print_tech: type,
                    material: type === 'resin' ? 'standard_resin' : 'petg',
                    color: color,
                    infill: infill,
                    layer_height: layerHeight,
                    volume: item.analysis.volume,
                    grams: item.analysis.grams,
                    hours: item.analysis.hours,
                    file_name: file?.name,
                    file_id: file?.id,
                },
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
        // Insert order_files (link files to order_items)
        if (files && files.length > 0) {
            const fileInserts = files.map((f, idx) => {
                const linkedItem = insertedItems?.[idx];
                return {
                    order_id: orderData.id,
                    order_item_id: linkedItem?.id || null,
                    file_name: f.name || null,
                    file_type: 'stl',
                    file_key: f.id, // R2 file key
                    category: 'models',
                    storage_provider: 'r2',
                };
            });

            const { error: fileError } = await supabase
                .from('order_files')
                .insert(fileInserts);

            if (fileError) console.error('Order files error:', fileError);
        }

        return NextResponse.json({ success: true, orderId: orderData.id });

    } catch (error: any) {
        console.error('Create printing order API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
