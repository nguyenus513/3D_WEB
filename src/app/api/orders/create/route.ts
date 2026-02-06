import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { generateId } from '@/lib/generateId';
import { stripHtml } from '@/lib/security/sanitize';

// Supabase admin client with service role key (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface OrderItem {
    productId?: string;
    sku?: string;
    name: string;
    price: number;
    quantity: number;
    size?: string;
}

interface CreateOrderRequest {
    items: OrderItem[];
    totalPrice: number;
    shippingAddress?: Record<string, unknown>;
    customerNote?: string;
    orderType?: 'ready_made' | 'custom' | 'printing';
}

export async function POST(request: NextRequest) {
    try {
        // Verify auth
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Parse request body
        const body: CreateOrderRequest = await request.json();
        const {
            items,
            totalPrice,
            shippingAddress,
            customerNote,
            orderType = 'ready_made'
        } = body;

        // SECURITY: Sanitize user input
        const sanitizedNote = customerNote ? stripHtml(customerNote).slice(0, 500) : null;

        if (!items || items.length === 0) {
            return NextResponse.json(
                { error: 'Giỏ hàng trống' },
                { status: 400 }
            );
        }

        // Get user from database
        const { data: user, error: userError } = await supabaseAdmin
            .from('profiles')
            .select('id, customer_code')
            .eq('email', session.user.email)
            .single();

        if (userError || !user) {
            return NextResponse.json(
                { error: 'Không tìm thấy thông tin người dùng' },
                { status: 404 }
            );
        }

        // SECURITY: Always generate server-side, never trust client-provided codes
        const orderCode = generateId.order();
        const customerCode = user.customer_code || generateId.user();

        // If user doesn't have customer code, update it
        if (!user.customer_code) {
            await supabaseAdmin
                .from('profiles')
                .update({ customer_code: customerCode })
                .eq('id', user.id);
        }

        // Calculate amounts
        const shippingFee = 0; // No shipping fee
        const total = totalPrice + shippingFee;

        // Create or get shipping address
        let shippingAddressId: string | null = null;

        if (shippingAddress && typeof shippingAddress === 'object') {
            // Check if it's an address_id or address object
            if (shippingAddress.id) {
                shippingAddressId = shippingAddress.id as string;
            } else if (shippingAddress.province) {
                // Create new address
                const { data: newAddress } = await supabaseAdmin
                    .from('addresses')
                    .insert({
                        user_id: user.id,
                        full_name: (shippingAddress.full_name as string) || null,
                        phone: (shippingAddress.phone as string) || null,
                        address_line: (shippingAddress.address_line as string) || null,
                        ward: (shippingAddress.ward as string) || null,
                        district: (shippingAddress.district as string) || null,
                        province: shippingAddress.province as string,
                        label: 'Đơn hàng',
                        is_default: false,
                    })
                    .select('id')
                    .single();

                if (newAddress) {
                    shippingAddressId = newAddress.id;
                }
            }
        } else {
            // Get default address
            const { data: defaultAddr } = await supabaseAdmin
                .from('addresses')
                .select('id')
                .eq('user_id', user.id)
                .eq('is_default', true)
                .single();

            if (defaultAddr) {
                shippingAddressId = defaultAddr.id;
            }
        }

        // Create order with FK instead of JSONB
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
                order_code: orderCode,
                user_id: user.id,
                order_type: orderType,
                status: 'pending',
                payment_status: 'pending',
                deposit_paid: false,
                subtotal: totalPrice,
                shipping_fee: shippingFee,
                total_amount: total,
                shipping_address: shippingAddress ? {
                    id: shippingAddressId,
                    ...shippingAddress
                } : null,
                customer_note: sanitizedNote,
            })
            .select('id, order_code')
            .single();

        if (orderError) {
            console.error('Order creation error:', orderError);
            return NextResponse.json(
                { error: 'Không thể tạo đơn hàng: ' + orderError.message },
                { status: 500 }
            );
        }

        // Create order items
        // Fetch all products involved in the order
        const productIds = items
            .map(item => item.productId)
            .filter((id): id is string => !!id);

        const { data: products, error: productsError } = await supabaseAdmin
            .from('products')
            .select('*')
            .in('id', productIds);

        if (productsError) {
            console.error('Error fetching products:', productsError);
            return NextResponse.json(
                { error: 'Không thể kiểm tra thông tin sản phẩm' },
                { status: 500 }
            );
        }

        const productMap = new Map((products || []).map(p => [p.id, p]));

        // Calculate order items with server-side pricing
        const orderItems = items.map(item => {
            let unitPrice = item.price; // Fallback (should be overridden below for ready_made)
            let productName = item.name;

            if (orderType === 'ready_made' && item.productId) {
                const product = productMap.get(item.productId);
                if (product) {
                    productName = product.name; // Use authoritative name

                    // Determine price
                    // Check for size-specific price first
                    let sizePrice: number | null = null;
                    if (item.size && Array.isArray(product.sizes)) {
                        const sizeObj = product.sizes.find((s: any) =>
                            typeof s === 'object' && s.name === item.size
                        );
                        if (sizeObj && typeof sizeObj.price === 'number') {
                            sizePrice = sizeObj.price;
                        }
                    }

                    if (sizePrice !== null) {
                        unitPrice = sizePrice;
                    } else {
                        // Use product sale price or base price
                        unitPrice = (typeof product.sale_price === 'number')
                            ? product.sale_price
                            : product.base_price;
                    }
                }
            }

            // For custom/printing orders, logic might differ (usually quoted), 
            // but for now we trust the input OR you should implement a Quote lookup here.
            // TODO: specific logic for custom/printing if needed.

            return {
                order_id: order.id,
                product_id: item.productId || null,
                product_sku: item.sku || null,
                product_name: productName,
                quantity: item.quantity,
                unit_price: unitPrice,
                total_price: unitPrice * item.quantity,
                size: item.size || null,
            };
        });

        // Recalculate total from secure items
        const calculatedSubtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
        const calculatedTotal = calculatedSubtotal + shippingFee;

        // Verify total match (optional: strictly enforce or just warn/update)
        // We will strictly enforce the server-calculated total

        // Update the order with calculated totals
        await supabaseAdmin
            .from('orders')
            .update({
                subtotal: calculatedSubtotal,
                total_amount: calculatedTotal
            })
            .eq('id', order.id);

        const { error: itemsError } = await supabaseAdmin
            .from('order_items')
            .insert(orderItems);

        if (itemsError) {
            console.error('Order items error:', itemsError);
            // Order was created but items failed - still return success
            // Admin can fix manually
        }

        return NextResponse.json({
            success: true,
            orderId: order.id,
            orderCode: order.order_code,
            customerCode: customerCode,
            total: total,
            depositAmount: Math.round(total * 0.5),
        });

    } catch (error) {
        console.error('Create order error:', error);
        return NextResponse.json(
            { error: 'Đã có lỗi xảy ra' },
            { status: 500 }
        );
    }
}
