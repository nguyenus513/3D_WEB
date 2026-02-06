import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { generateId } from '@/lib/generateId';
import { stripHtml } from '@/lib/security/sanitize';
import { requireCsrf } from '@/lib/security/csrf';

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

        const csrf = await requireCsrf(request);
        if (!csrf.valid) {
            return csrf.error!;
        }

        const body: CreateOrderRequest = await request.json();
        const {
            items,
            totalPrice,
            shippingAddress,
            customerNote,
            orderType = 'ready_made'
        } = body;

        if (orderType !== 'ready_made') {
            return NextResponse.json(
                { error: 'Unsupported order type for this endpoint' },
                { status: 400 }
            );
        }

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

        if (!user.customer_code) {
            await supabaseAdmin
                .from('profiles')
                .update({ customer_code: customerCode })
                .eq('id', user.id);
        }

        const shippingFee = 0;
        const total = totalPrice + shippingFee;

        // Create or get shipping address
        let shippingAddressId: string | null = null;
        let shippingSnapshot: Record<string, unknown> | null = null;

        if (shippingAddress && typeof shippingAddress === 'object') {
            // If address_id provided, verify ownership
            if ((shippingAddress as any).id) {
                const addressId = (shippingAddress as any).id as string;
                const { data: addr } = await supabaseAdmin
                    .from('addresses')
                    .select('id, user_id, full_name, phone, address_line, ward, district, province')
                    .eq('id', addressId)
                    .single();

                if (!addr || addr.user_id !== user.id) {
                    return NextResponse.json(
                        { error: 'Địa chỉ không hợp lệ' },
                        { status: 403 }
                    );
                }

                shippingAddressId = addr.id;
                shippingSnapshot = {
                    full_name: addr.full_name,
                    phone: addr.phone,
                    address_line: addr.address_line,
                    ward: addr.ward,
                    district: addr.district,
                    province: addr.province,
                };
            } else if ((shippingAddress as any).province) {
                const fullName = (shippingAddress as any).full_name as string | undefined;
                const phone = (shippingAddress as any).phone as string | undefined;
                const addressLine = (shippingAddress as any).address_line as string | undefined;
                const district = (shippingAddress as any).district as string | undefined;
                const province = (shippingAddress as any).province as string | undefined;

                if (!fullName || !phone || !addressLine || !district || !province) {
                    return NextResponse.json(
                        { error: 'Thiếu thông tin địa chỉ giao hàng' },
                        { status: 400 }
                    );
                }

                const { data: newAddress } = await supabaseAdmin
                    .from('addresses')
                    .insert({
                        user_id: user.id,
                        full_name: fullName,
                        phone: phone,
                        address_line: addressLine,
                        ward: (shippingAddress as any).ward || null,
                        district: district,
                        province: province,
                        label: 'Đơn hàng',
                        is_default: false,
                    })
                    .select('id, full_name, phone, address_line, ward, district, province')
                    .single();

                if (newAddress) {
                    shippingAddressId = newAddress.id;
                    shippingSnapshot = {
                        full_name: newAddress.full_name,
                        phone: newAddress.phone,
                        address_line: newAddress.address_line,
                        ward: newAddress.ward,
                        district: newAddress.district,
                        province: newAddress.province,
                    };
                }
            }
        }

        if (!shippingAddressId && !shippingSnapshot) {
            const { data: defaultAddr } = await supabaseAdmin
                .from('addresses')
                .select('id, full_name, phone, address_line, ward, district, province')
                .eq('user_id', user.id)
                .eq('is_default', true)
                .single();

            if (defaultAddr) {
                shippingAddressId = defaultAddr.id;
                shippingSnapshot = {
                    full_name: defaultAddr.full_name,
                    phone: defaultAddr.phone,
                    address_line: defaultAddr.address_line,
                    ward: defaultAddr.ward,
                    district: defaultAddr.district,
                    province: defaultAddr.province,
                };
            }
        }

        if (!shippingAddressId && !shippingSnapshot) {
            return NextResponse.json(
                { error: 'Vui lòng cung cấp địa chỉ giao hàng hợp lệ' },
                { status: 400 }
            );
        }

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
                address_id: shippingAddressId,
                shipping_address_snapshot: shippingSnapshot,
                notes: sanitizedNote,
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

        const orderItems = items.map(item => {
            let unitPrice = item.price;
            let productName = item.name;

            if (orderType === 'ready_made' && item.productId) {
                const product = productMap.get(item.productId);
                if (product) {
                    productName = product.name;

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
                        unitPrice = (typeof product.sale_price === 'number')
                            ? product.sale_price
                            : product.base_price;
                    }
                }
            }

            return {
                order_id: order.id,
                product_id: item.productId || null,
                sku: item.sku || null,
                name: productName,
                size: item.size || null,
                quantity: item.quantity,
                unit_price: unitPrice,
                total_price: unitPrice * item.quantity,
                configuration: item.size ? { size: item.size } : {},
            };
        });

        const calculatedSubtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
        const calculatedTotal = calculatedSubtotal + shippingFee;

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
        }

        return NextResponse.json({
            success: true,
            orderId: order.id,
            orderCode: order.order_code,
            customerCode: customerCode,
            total: calculatedTotal,
            depositAmount: Math.round(calculatedTotal * 0.5),
        });

    } catch (error) {
        console.error('Create order error:', error);
        return NextResponse.json(
            { error: 'Đã có lỗi xảy ra' },
            { status: 500 }
        );
    }
}
