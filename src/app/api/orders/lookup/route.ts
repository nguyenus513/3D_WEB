/**
 * Single Order Lookup API
 * GET /api/orders/lookup?id=xxx
 *
 * Searches unified orders table for a specific order
 * Used by checkout success page to display payment info
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/unifiedConfig';
import { getProfileId } from '@/lib/utils/getProfileId';
import { getPaymentSetup } from '@/lib/services/paymentConfigService';
import { parseOrderStorageKey } from '@/lib/storage/order-storage';

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getProfileId(session.user, supabaseAdmin);
        if (!userId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get('id');

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
        }

        // Unified Query: single table source of truth
        const query = supabaseAdmin
            .from('orders')
            .select('*, order_items(*)')
            .eq('user_id', userId);

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
        if (isUUID) {
            query.eq('id', orderId);
        } else {
            query.eq('order_code', orderId);
        }

        const { data: foundOrder, error } = await query.maybeSingle();

        if (error) {
            console.error('[OrderLookup] DB Error:', error);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        if (!foundOrder) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const order = foundOrder as any;
        const orderType = order.order_type || 'ready_made';

        // Normalize items
        let items: any[] = [];
        let configData: any = null;

        if (orderType === 'ready_made') {
            const relationalItems = Array.isArray(order.order_items) ? order.order_items : [];
            const jsonItems = Array.isArray(order.items) ? order.items : [];
            items = relationalItems.length > 0 ? relationalItems : jsonItems;
        } else if (orderType === 'custom') {
            const config = order.custom_config || (order.items_config && order.items_config.custom) || {};
            configData = config;
            items = [{
                name: order.notes ? `Custom: ${order.notes}` : 'Đơn hàng Custom',
                quantity: 1,
                total_price: order.total_amount || order.subtotal || 0,
                configuration: config
            }];
        } else if (orderType === 'printing') {
            const config = order.printing_config || (order.items_config && order.items_config.printing) || {};
            const relationalItems = Array.isArray(order.order_items) ? order.order_items : [];
            const analysisSummary = relationalItems.reduce((sum: { grams: number; hours: number; price: number }, item: any) => {
                const analysis = item?.configuration?.analysis || {};
                const qty = Number(item.quantity || 1);
                return {
                    grams: sum.grams + Number(analysis.grams || 0) * qty,
                    hours: sum.hours + Number(analysis.hours || 0) * qty,
                    price: sum.price + Number(item.total_price || 0),
                };
            }, { grams: 0, hours: 0, price: 0 });
            configData = config;
            items = [{
                name: `In 3D - ${config.type || 'FDM'}`,
                quantity: config.quantity || 1,
                total_price: order.total_amount || 0,
                configuration: config
            }];
            configData = { ...config, analysis: analysisSummary };
        }

        const { data: fileRows } = await supabaseAdmin
            .from('order_files')
            .select('file_key, file_name, storage_provider, drive_url, archived_at')
            .or(`order_id.eq.${order.id},order_code.eq.${order.order_code}`);

        const files = (fileRows || []).filter((f: any) => f.file_key);
        const isArchived = !!order.archived_at || files.some((f: any) => (f.storage_provider || 'r2') === 'drive' || f.archived_at);
        const visibleFiles = isArchived ? [] : files.filter((f: any) => (f.storage_provider || 'r2') !== 'drive');

        const customImages: Array<{ url: string; thumbnail: string; name: string; key: string }> = [];
        const printingFiles: Array<{ url: string; name: string; key: string }> = [];

        visibleFiles.forEach((file: any) => {
            const key = file.file_key as string;
            const parsed = parseOrderStorageKey(key);
            if (!parsed) return;
            const fileUrl = `/api/files/${key}`;
            const name = file.file_name || parsed.fileName || key.split('/').pop() || 'file';

            if (parsed.category.startsWith('custom_')) {
                customImages.push({ url: fileUrl, thumbnail: fileUrl, name, key });
            } else if (parsed.category.startsWith('printing_')) {
                printingFiles.push({ url: fileUrl, name, key });
            }
        });

        if (orderType === 'custom') {
            configData = { ...(configData || {}), images: customImages };
        }
        if (orderType === 'printing') {
            configData = { ...(configData || {}), files: printingFiles };
        }

        // Fetch payment info (preferred)
        const { data: payment } = await supabaseAdmin
            .from('payments')
            .select('transaction_code, gateway_response, amount, status, method, created_at')
            .eq('order_id', order.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const gateway = (payment?.gateway_response || {}) as Record<string, unknown>;
        const total = Number(order.total_amount || 0);
        const depositAmount = Number(order.deposit_amount || Math.round(total * 0.5));

        let transferContent = (payment?.transaction_code as string) || (gateway.reference_code as string) || order.order_code;
        let qrUrl = gateway.qr_url as string | undefined;
        let bankCode = gateway.bank_code as string | undefined;
        let accountNo = gateway.account_no as string | undefined;
        let accountName = gateway.account_name as string | undefined;

        // Fallback to payment config if gateway data missing
        if (!qrUrl || !bankCode || !accountNo || !accountName) {
            const productType = orderType === 'ready_made' ? 'product' : orderType;
            try {
                const setup = await getPaymentSetup(
                    order.user_id,
                    productType,
                    order.order_code,
                    depositAmount
                );
                transferContent = transferContent || setup.transferContent;
                qrUrl = qrUrl || setup.qrUrl;
                bankCode = bankCode || setup.bankInfo.bank_code;
                accountNo = accountNo || setup.bankInfo.account_no;
                accountName = accountName || setup.bankInfo.account_name;
            } catch (e) {
                if (process.env.NODE_ENV !== 'production') {
                    console.warn('[OrderLookup] Payment setup fallback failed:', e);
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                id: order.id,
                order_code: order.order_code,
                order_type: orderType,
                total,
                total_amount: total,
                deposit_amount: depositAmount,
                deposit_paid: order.deposit_paid ?? false,
                status: order.status,
                payment_status: order.payment_status || 'pending',
                shipping_address: order.shipping_address_snapshot,
                created_at: order.created_at,
                items,
                custom_config: orderType === 'custom' ? configData : undefined,
                printing_config: orderType === 'printing' ? configData : undefined,
                demo_image_url: isArchived ? null : order.demo_image_url,
                archived_at: order.archived_at || null,
                payment: {
                    bank_id: bankCode || null,
                    account_no: accountNo || null,
                    account_name: accountName || null,
                    transfer_content: transferContent,
                    qr_url: qrUrl || null,
                    amount: payment?.amount || depositAmount,
                    status: payment?.status || 'pending',
                },
            },
        });

    } catch (error) {
        console.error('[OrderLookup] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
