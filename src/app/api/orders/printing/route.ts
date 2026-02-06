/**
 * Printing Order Creation API
 * POST /api/orders/printing
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';
import { generateId } from '@/lib/generateId';
import { getPaymentSetup } from '@/lib/services/paymentConfigService';
import { BANK_INFO } from '@/lib/vietqr';
import { stripHtml } from '@/lib/security/sanitize';
import { requireCsrf } from '@/lib/security/csrf';
import { fetchPrintingPricing, calculatePrintingMetrics } from '@/lib/services/pricingService';

interface PrintingItemPayload {
    name: string;
    quantity: number;
    unit_price: number;
    analysis?: Record<string, unknown>;
    file?: {
        id?: string;
        key?: string;
        name?: string;
        url?: string;
        thumbnail?: string;
    };
}

interface PrintingOrderRequest {
    orderCode?: string;
    items: PrintingItemPayload[];
    printingConfig: {
        type: 'fdm' | 'resin';
        color: string;
        infill?: string;
        layerHeight?: string;
        notes?: string;
    };
    shippingAddress: {
        full_name: string;
        phone: string;
        address_line: string;
        ward?: string;
        district?: string;
        province: string;
    };
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const csrf = await requireCsrf(request);
        if (!csrf.valid) {
            return csrf.error!;
        }

        const supabase = getAdminSupabase();
        const userId = await getProfileId(session.user, supabase);
        if (!userId) {
            return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 400 });
        }

        const body: PrintingOrderRequest = await request.json();
        const { items, printingConfig, shippingAddress } = body;
        const sanitizedNotes = printingConfig?.notes ? stripHtml(printingConfig.notes).slice(0, 500) : null;

        if (!items || items.length === 0) {
            return NextResponse.json({ success: false, error: 'Missing items' }, { status: 400 });
        }

        if (!shippingAddress?.full_name || !shippingAddress?.phone || !shippingAddress?.province) {
            return NextResponse.json({ success: false, error: 'Missing shipping address' }, { status: 400 });
        }
        const pricingList = await fetchPrintingPricing();
        const pricing = pricingList.find((p) => p.print_type === printingConfig.type);
        if (!pricing) {
            return NextResponse.json({ success: false, error: 'Pricing not configured' }, { status: 400 });
        }

        const infill = printingConfig.infill || (printingConfig.type === 'fdm' ? '20%' : '100%');
        const layerHeight = printingConfig.layerHeight || '0.2';

        let normalizedItems: Array<PrintingItemPayload & { metrics: { grams: number; hours: number; price: number }; volume: number; file_key?: string; file_name?: string; }> = [];
        try {
            normalizedItems = items.map((item) => {
                const volume = Number((item.analysis as any)?.volume);
                if (!volume || Number.isNaN(volume) || volume <= 0) {
                    throw new Error('Invalid analysis volume');
                }
                const metrics = calculatePrintingMetrics({
                    volumeCm3: volume,
                    printType: printingConfig.type,
                    infill,
                    layerHeight,
                    pricing,
                });
                return {
                    ...item,
                    unit_price: metrics.price,
                    metrics,
                    volume,
                    file_key: item.file?.key,
                    file_name: item.file?.name,
                };
            });
        } catch (err) {
            return NextResponse.json({ success: false, error: (err as Error).message || 'Invalid analysis data' }, { status: 400 });
        }

        const subtotal = normalizedItems.reduce((sum, item) => sum + (item.unit_price || 0) * (item.quantity || 1), 0);
        const totalQuantity = normalizedItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const totalAmount = subtotal;
        const depositPercent = Number(pricing.deposit_percent || 100);
        const depositAmount = Math.round(totalAmount * (depositPercent / 100));
        const orderCode = (body.orderCode && body.orderCode.trim()) ? body.orderCode.trim().toUpperCase() : generateId.printing();

        // Prepare items JSON for orders.items
        const jsonItems = normalizedItems.map((item) => ({
            id: crypto.randomUUID(),
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.unit_price * item.quantity,
            configuration: {
                analysis: {
                    volume: item.volume,
                    grams: item.metrics.grams,
                    hours: item.metrics.hours,
                },
                file_key: item.file_key || null,
                file_name: item.file_name || item.name,
                print_tech: printingConfig.type,
                color: printingConfig.color,
                infill,
                layer_height: layerHeight,
            },
            type: 'printing',
        }));

        // Create order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                order_code: orderCode,
                user_id: userId,
                order_type: 'printing',
                status: 'pending',
                payment_status: 'pending',
                subtotal: subtotal,
                shipping_fee: 0,
                total_amount: totalAmount,
                deposit_amount: depositAmount,
                shipping_address_snapshot: shippingAddress,
                printing_config: {
                    type: printingConfig.type,
                    color: printingConfig.color,
                    infill,
                    layerHeight,
                    quantity: totalQuantity,
                },
                items: jsonItems,
                notes: sanitizedNotes,
            })
            .select()
            .single();

        if (orderError || !order) {
            console.error('[Printing API] Order create error:', orderError);
            return NextResponse.json({ success: false, error: 'Order create failed' }, { status: 500 });
        }

        // Attach uploaded files to this order (order_files)
        await supabase
            .from('order_files')
            .update({
                order_id: order.id,
                order_code: orderCode,
            })
            .eq('order_code', orderCode)
            .is('order_id', null)
            .eq('owner_id', userId);

        // Insert normalized order_items
        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(jsonItems.map((item) => ({
                order_id: order.id,
                product_id: null,
                name: item.name,
                sku: null,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
                configuration: item.configuration,
            })));

        if (itemsError) {
            console.warn('[Printing API] order_items insert failed:', itemsError);
        }

        // Payment setup + create payment record
        const paymentSetup = await getPaymentSetup(
            userId,
            'printing',
            orderCode,
            depositAmount,
            session.user.email
        );

        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        const { error: paymentError } = await supabase
            .from('payments')
            .insert({
                order_id: order.id,
                transaction_code: paymentSetup.transferContent,
                amount: depositAmount,
                status: 'pending',
                method: 'QR',
                gateway_response: {
                    qr_url: paymentSetup.qrUrl,
                    bank_code: paymentSetup.bankInfo.bank_code,
                    account_no: paymentSetup.bankInfo.account_no,
                    account_name: paymentSetup.bankInfo.account_name,
                    expires_at: expiresAt.toISOString(),
                    reference_code: orderCode,
                },
            });

        if (paymentError) {
            console.error('[Printing API] Payment create error:', paymentError);
        }

        return NextResponse.json({
            success: true,
            data: {
                orderId: order.id,
                orderCode,
                amount: depositAmount,
                payment: {
                    bank_id: paymentSetup.bankInfo.bank_code,
                    account_no: paymentSetup.bankInfo.account_no,
                    account_name: paymentSetup.bankInfo.account_name,
                    transfer_content: paymentSetup.transferContent,
                    qr_url: paymentSetup.qrUrl,
                    amount: depositAmount,
                    bank_name: BANK_INFO[paymentSetup.bankInfo.bank_code as keyof typeof BANK_INFO]?.shortName || paymentSetup.bankInfo.bank_code,
                },
            },
        });
    } catch (error) {
        console.error('[Printing API] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
