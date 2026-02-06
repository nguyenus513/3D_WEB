
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

        // Create Order
        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .insert({
                order_code: orderCode,
                user_id: user.id,
                order_type: 'printing',
                status: 'pending',
                payment_status: 'pending',
                subtotal: totalPrice,
                shipping_fee: 0,
                total_amount: totalPrice,
                deposit_amount: totalPrice, // 100% deposit for printing
                customer_note: fullNote,
                shipping_address: shippingAddress,
            })
            .select()
            .single();

        if (orderError) {
            console.error('Printing Order Insert Error:', orderError);
            return NextResponse.json({ error: orderError.message }, { status: 500 });
        }

        // Insert configs (one per distinct file item)
        // Note: Client logic mapped files 1:1 with items
        // We iterate through items and match with index if possible or assuming 1:1
        // The client code had: for (const item of order.items) insert config...

        const configInserts = items.map(item => ({
            order_id: orderData.id,
            print_tech: type,
            material: type === 'resin' ? 'standard_resin' : 'pla',
            color: color,
            quantity: item.quantity,
            print_volume: item.analysis.volume,
            print_weight: item.analysis.grams,
            print_time: item.analysis.hours,
        }));

        const { error: configError } = await supabase
            .from('order_configs')
            .insert(configInserts);

        if (configError) {
            console.error('Order configs error:', configError);
            // Non-fatal? Maybe warnings. Admin can see order but missing config details.
        }

        // Insert files
        if (files && files.length > 0) {
            const fileInserts = files.map(f => ({
                order_id: orderData.id,
                file_id: f.id,
                file_type: 'stl',
                file_name: f.name || null,
            }));

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
