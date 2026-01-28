import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { generateId } from '@/lib/generateId';
import { z } from 'zod';

// Supabase admin client
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

// Cart item schema for validation - relaxed to handle various cart item formats
const CartItemSchema = z.object({
    id: z.string(),
    type: z.enum(['product', 'custom', 'print']),
    name: z.string(),
    price: z.number(),
    quantity: z.number().int().positive(),

    // Product fields - all optional
    productId: z.string().nullish(),
    sku: z.string().nullish(),
    size: z.string().nullish(),
    image: z.string().nullish(),
    originalPrice: z.number().nullish(),

    // Print fields - more flexible
    printOptions: z.object({
        type: z.enum(['fdm', 'resin']),
        color: z.string(),
        infill: z.union([z.string(), z.number()]).optional(),
        layerHeight: z.union([z.string(), z.number()]).optional(),
    }).nullish(),
    printFiles: z.array(z.object({
        id: z.string(),
        name: z.string(),
        url: z.string().nullish(),
        thumbnail: z.string().nullish(),
        analysis: z.object({
            volume: z.number(),
            grams: z.number(),
            hours: z.number(),
            price: z.number(),
            boundingBox: z.object({
                x: z.number(),
                y: z.number(),
                z: z.number(),
            }).optional(),
        }).nullish(),
    })).nullish(),

    // Custom fields - all optional
    description: z.string().nullish(),
    customFiles: z.array(z.object({
        name: z.string(),
        url: z.string(),
    })).nullish(),
}).passthrough(); // Allow extra fields

const CreateMasterOrderSchema = z.object({
    addressId: z.string().uuid(),
    items: z.array(CartItemSchema).min(1),
    note: z.string().nullish(),
    shipping: z.number().default(0),

});

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body
        const body = await request.json();

        // Defensive: normalize item types before validation
        // This handles legacy cart items with incorrect types
        if (body.items && Array.isArray(body.items)) {
            body.items = body.items.map((item: Record<string, unknown>) => {
                let type = item.type as string;
                // Normalize legacy types
                if (type === 'printing') type = 'print';
                if (type === 'ready_made') type = 'product';
                return { ...item, type };
            });
        }

        // Validate with normalized data
        const validation = CreateMasterOrderSchema.safeParse(body);

        if (!validation.success) {
            console.error('Master order validation failed:', validation.error.issues);
            return NextResponse.json(
                { error: 'Invalid request', details: validation.error.issues },
                { status: 400 }
            );
        }

        const { addressId, items, note, shipping } = validation.data;

        // Get user from database
        const { data: user, error: userError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', session.user.email.toLowerCase())
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify address belongs to user
        const { data: address, error: addressError } = await supabaseAdmin
            .from('addresses')
            .select('id')
            .eq('id', addressId)
            .eq('user_id', user.id)
            .single();

        if (addressError || !address) {
            return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
        }

        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const total = subtotal + shipping;

        // Generate master order number
        const masterOrderNumber = generateId.master();

        // Create master order
        const { data: masterOrder, error: masterError } = await supabaseAdmin
            .from('master_orders')
            .insert({
                order_number: masterOrderNumber,
                user_id: user.id,
                address_id: addressId,
                subtotal,
                shipping,
                total,
                status: 'pending',
                payment_status: 'pending',
                note,
            })
            .select()
            .single();

        if (masterError) {
            console.error('Failed to create master order:', masterError);
            return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
        }

        // Group items by type
        const productItems = items.filter(i => i.type === 'product');
        const printItems = items.filter(i => i.type === 'print');
        const customItems = items.filter(i => i.type === 'custom');

        const subOrders: { type: string; orderNumber: string }[] = [];

        // Create product order if there are product items
        if (productItems.length > 0) {
            const productOrderNumber = generateId.product();
            const productTotal = productItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

            const { data: productOrder, error: productError } = await supabaseAdmin
                .from('orders')
                .insert({
                    order_number: productOrderNumber,
                    master_order_id: masterOrder.id,
                    user_id: user.id,
                    address_id: addressId,
                    subtotal: productTotal,
                    shipping: 0,
                    total: productTotal,
                    status: 'pending',
                    payment_status: 'pending',
                    note,
                })
                .select()
                .single();

            if (productError) {
                console.error('Failed to create product order:', productError);
            } else {
                subOrders.push({ type: 'product', orderNumber: productOrderNumber });

                // Create order items
                const orderItems = productItems.map(item => ({
                    order_id: productOrder.id,
                    product_id: item.productId,
                    sku: item.sku,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    size: item.size,
                    subtotal: item.price * item.quantity,
                }));

                await supabaseAdmin.from('order_items').insert(orderItems);
            }
        }

        // Create print orders
        if (printItems.length > 0) {
            for (const item of printItems) {
                const printOrderNumber = generateId.printing();

                const { error: printError } = await supabaseAdmin
                    .from('print_orders')
                    .insert({
                        order_number: printOrderNumber,
                        master_order_id: masterOrder.id,
                        user_id: user.id,
                        print_type: item.printOptions?.type || 'fdm',
                        color: item.printOptions?.color,
                        infill: item.printOptions?.infill,
                        layer_height: item.printOptions?.layerHeight,
                        files: item.printFiles || [],
                        total_price: item.price * item.quantity,
                        quantity: item.quantity,
                        status: 'pending',
                        notes: note,
                    });

                if (printError) {
                    console.error('Failed to create print order:', printError);
                } else {
                    subOrders.push({ type: 'print', orderNumber: printOrderNumber });
                }
            }
        }

        // Create custom orders
        if (customItems.length > 0) {
            for (const item of customItems) {
                const customOrderNumber = generateId.custom();

                const { error: customError } = await supabaseAdmin
                    .from('custom_orders')
                    .insert({
                        order_number: customOrderNumber,
                        master_order_id: masterOrder.id,
                        user_id: user.id,
                        description: item.description || item.name,
                        files: item.customFiles || [],
                        estimated_price: item.price * item.quantity,
                        quantity: item.quantity,
                        status: 'pending',
                    });

                if (customError) {
                    console.error('Failed to create custom order:', customError);
                } else {
                    subOrders.push({ type: 'custom', orderNumber: customOrderNumber });
                }
            }
        }

        return NextResponse.json({
            success: true,
            masterOrderId: masterOrder.id,
            masterOrderNumber,
            subOrders,
            total,
        });

    } catch (error) {
        console.error('Master order creation error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET - Fetch master orders for current user
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user
        const { data: user } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', session.user.email.toLowerCase())
            .single();

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get master orders with related sub-orders
        const { data: masterOrders, error } = await supabaseAdmin
            .from('master_orders')
            .select(`
                *,
                address:addresses(*),
                orders(id, order_number, status, total),
                print_orders(id, order_number, status, total_price),
                custom_orders(id, order_number, status, estimated_price)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Failed to fetch master orders:', error);
            return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
        }

        return NextResponse.json({ orders: masterOrders });

    } catch (error) {
        console.error('Get master orders error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
