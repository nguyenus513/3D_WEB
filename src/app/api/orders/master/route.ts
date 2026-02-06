import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { generateId } from '@/lib/generateId';
import { z } from 'zod';
import { config } from '@/config/unifiedConfig';

// Supabase admin client
const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

// Cart item schema for validation
const CartItemSchema = z.object({
    id: z.string(),
    type: z.enum(['product', 'custom', 'print']),
    name: z.string(),
    price: z.number(),
    quantity: z.number().int().positive(),
}).passthrough();

const CreateMasterOrderSchema = z.object({
    addressId: z.string().uuid(),
    items: z.array(CartItemSchema).min(1),
    note: z.string().nullish(),
    shipping: z.number().default(0),
});

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Normalize legacy types
        if (body.items && Array.isArray(body.items)) {
            body.items = body.items.map((item: Record<string, unknown>) => {
                const typeMap: Record<string, string> = {
                    'printing': 'print',
                    'ready_made': 'product',
                    'custom_single': 'custom',
                    'custom_couple': 'custom',
                    'custom_group': 'custom',
                };
                let type = item.type as string;
                if (typeMap[type]) type = typeMap[type];
                return { ...item, type };
            });
        }

        const validation = CreateMasterOrderSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid request', details: validation.error.issues },
                { status: 400 }
            );
        }

        const { addressId, items, note, shipping } = validation.data;

        // Get user
        const { data: user, error: userError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', session.user.email.toLowerCase())
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify address
        const { data: address } = await supabaseAdmin
            .from('addresses')
            .select('*') // Get full address logic if needed for snapshot
            .eq('id', addressId)
            .eq('user_id', user.id)
            .single();

        if (!address) {
            return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
        }

        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const total = subtotal + shipping;
        const masterOrderCode = generateId.master();

        // 1. Create PARENT Order (Master) in 'orders' table
        console.log('[MasterAPI] Creating Parent Order:', masterOrderCode);
        const { data: parentOrder, error: parentError } = await supabaseAdmin
            .from('orders')
            .insert({
                order_code: masterOrderCode,
                user_id: user.id,
                // No address_id fk required strictly if using snapshot, but good for ref
                shipping_address_snapshot: {
                    full_name: address.full_name,
                    phone: address.phone,
                    province: address.province,
                    district: address.district,
                    ward: address.ward,
                    address_line: address.address_line
                },
                subtotal,
                shipping_fee: shipping,
                total_amount: total,
                deposit_amount: 0, // Master usually aggregate
                status: 'pending',
                payment_status: 'pending',
                order_type: 'master', // New type for parent
                notes: note,
            })
            .select()
            .single();

        if (parentError) {
            console.error('[MasterAPI] Failed to create parent order:', parentError);
            return NextResponse.json({ error: 'Failed to create parent order' }, { status: 500 });
        }

        // 2. Create CHILD Orders
        const productItems = items.filter(i => i.type === 'product');
        const printItems = items.filter(i => i.type === 'print');
        const customItems = items.filter(i => i.type === 'custom');
        const subOrders: { type: string; orderNumber: string }[] = [];

        // A. Product Sub-Order
        if (productItems.length > 0) {
            const productTotal = productItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const productOrderCode = generateId.product();

            const { data: childOrder, error: childError } = await supabaseAdmin
                .from('orders')
                .insert({
                    order_code: productOrderCode,
                    parent_order_id: parentOrder.id, // Link to parent
                    user_id: user.id,
                    subtotal: productTotal,
                    shipping_fee: 0, // Shipping usually on parent
                    total_amount: productTotal,
                    status: 'pending',
                    payment_status: 'pending',
                    order_type: 'ready_made',
                    notes: note,
                    shipping_address_snapshot: parentOrder.shipping_address_snapshot
                })
                .select()
                .single();

            if (!childError) {
                subOrders.push({ type: 'product', orderNumber: productOrderCode });
                // Add items
                const orderItems = productItems.map(item => ({
                    order_id: childOrder.id,
                    product_id: item.productId,
                    sku: item.sku,
                    name: item.name,
                    unit_price: item.price,
                    quantity: item.quantity,
                    total_price: item.price * item.quantity,
                    configuration: { size: item.size }
                }));
                await supabaseAdmin.from('order_items').insert(orderItems);
            }
        }

        // B. Custom Sub-Orders
        for (const item of customItems) {
            const customOrderCode = generateId.custom();
            const totalPrice = item.price * item.quantity;

            const { error: customError } = await supabaseAdmin
                .from('orders')
                .insert({
                    order_code: customOrderCode,
                    parent_order_id: parentOrder.id,
                    user_id: user.id,
                    subtotal: totalPrice,
                    total_amount: totalPrice,
                    status: 'pending',
                    payment_status: 'pending',
                    order_type: 'custom',
                    custom_config: {
                        description: item.description || item.name,
                        files: item.customFiles || [],
                        quantity: item.quantity
                    },
                    items_config: { // Redundant backup
                        custom: { description: item.description || item.name, files: item.customFiles }
                    },
                    shipping_address_snapshot: parentOrder.shipping_address_snapshot
                });

            if (!customError) subOrders.push({ type: 'custom', orderNumber: customOrderCode });
        }

        // C. Print Sub-Orders
        for (const item of printItems) {
            const printOrderCode = generateId.printing();
            const totalPrice = item.price * item.quantity;
            const itemAny = item as any;
            const printOptions = itemAny.printOptions || {};

            const { error: printError } = await supabaseAdmin
                .from('orders')
                .insert({
                    order_code: printOrderCode,
                    parent_order_id: parentOrder.id,
                    user_id: user.id,
                    subtotal: totalPrice,
                    total_amount: totalPrice,
                    status: 'pending',
                    payment_status: 'pending',
                    order_type: 'printing',
                    printing_config: {
                        type: printOptions.type || 'fdm',
                        color: printOptions.color,
                        files: itemAny.printFiles || [],
                        quantity: item.quantity
                    },
                    items_config: {
                        printing: { type: printOptions.type, files: itemAny.printFiles }
                    },
                    shipping_address_snapshot: parentOrder.shipping_address_snapshot
                });

            if (!printError) subOrders.push({ type: 'print', orderNumber: printOrderCode });
        }

        return NextResponse.json({
            success: true,
            masterOrderId: parentOrder.id,
            masterOrderNumber: masterOrderCode,
            subOrders,
            total,
        });

    } catch (error) {
        console.error('Master order creation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET - Fetch master orders (Parents)
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: user } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', session.user.email.toLowerCase())
            .single();

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Fetch orders that are PARENTS (order_type = 'master' OR generic parent logic if desired)
        // Or fetch all and let frontend group? 
        // Strategy: Fetch only 'master' type orders

        const { data: masterOrders, error } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .eq('order_type', 'master')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // If we want to return children structure as well, we'd need a join or separate query.
        // For simple list, we return the parents. Frontend can expand details by fetching children via parent_order_id 
        // OR we can fetch children here.

        // Let's attach children for fullness if volume is low, or keep simple.
        // Keeping simple for now to align with 'my-orders' which shows flat list.
        // BUT 'my-orders' unified route might show duplicates if we show both Master and Children.
        // The previous 'my-orders' route fetches ALL. 
        // This route specifically asked for MASTER orders.

        return NextResponse.json({ orders: masterOrders || [] });

    } catch (error) {
        console.error('Get master orders error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
