
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { stripHtml } from '@/lib/security/sanitize';
import { generateId } from '@/lib/generateId';

// Types from client-side
interface FileInfo {
    id: string;
    key?: string;
    name: string;
    size?: number;
    type?: string;
    url?: string;
    fileId?: string;
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
            .from('users')
            .select('id, customer_code')
            .eq('email', session.user.email)
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Generate ID
        const orderCode = generateId.printing();
        const now = new Date().toISOString();

        // Sanitize customer notes (print settings are stored in print_jobs table separately)
        const customerNote = notes ? stripHtml(notes).slice(0, 1000) : null;

        // Create parent order
        // Note: orders table has shipping_address_snapshot (not shipping_address)
        //       and no customer_note or deposit_paid columns
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
                shipping_address_snapshot: shippingAddress,
                notes: customerNote,
                created_at: now,
                updated_at: now,
            })
            .select()
            .single();


        if (orderError) {
            console.error('Printing Order Insert Error:', orderError);
            return NextResponse.json({ error: orderError.message }, { status: 500 });
        }


        // cartCode already defined above when creating order
        // Insert child order_items, one per file - new schema
        const orderItemInserts = items.map((item: any, index: number) => {
            const file = files[index];
            const itemCode = generateId.order(); // 8 char HEX
            const fullCode = `${orderCode}_${itemCode}`; // ORDER_ITEM format
            const fileKey = file?.key || file?.id || null;

            return {
                order_id: orderData.id,
                product_id: null, // No product for 3D printing
                item_code: itemCode,
                full_code: fullCode,
                name: file?.name || `3D Print ${index + 1}`,
                quantity: item.quantity,
                unit_price: item.analysis.price,
                // total_price is a generated column (quantity * unit_price)
                item_type: 'print_3d',
                production_status: 'waiting',
                configuration: {
                    fileName: file?.name || null,
                    fileKey,
                    fileUrl: file?.url || (fileKey ? `/api/files/${fileKey}` : null),
                    fileId: file?.fileId || null,
                    fileType: file?.type || 'model/stl',
                    fileSize: file?.size || 0,
                },
                created_at: now,
            };
        });

        const { data: insertedItems, error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItemInserts)
            .select();

        if (itemsError) {
            console.error('Order items insert error:', itemsError);
            return NextResponse.json({ error: `Failed to create order items: ${itemsError.message}` }, { status: 500 });
        }

        // Insert print jobs (1:1 with order_items)
        // Uses actual `print_jobs` table (not the non-existent `order_item_print_configs`)
        if (insertedItems && insertedItems.length > 0) {
            const printJobInserts = insertedItems.map((item: any, index: number) => ({
                order_item_id: item.id,
                material: type === 'resin' ? 'standard_resin' : 'petg',
                color: color,
                infill: type === 'fdm' ? parseInt(infill) || 20 : null,
                layer_height: type === 'fdm' ? parseFloat(layerHeight) || 0.2 : null,
                estimated_grams: items[index].analysis.grams,
                estimated_hours: items[index].analysis.hours,
                status: 'waiting',
                created_at: now,
                updated_at: now,
            }));

            const { error: jobError } = await supabase
                .from('print_jobs')
                .insert(printJobInserts);

            if (jobError) {
                console.error('[PrintingOrder] Failed to insert print_jobs:', jobError);
                // Non-fatal: order still exists, jobs can be backfilled
            }
        }
        // Link files to order via `files` + `file_links` tables
        // UploadService already created `files` records during upload.
        // Here we create `file_links` to associate files with order_items.
        if (files && files.length > 0) {
            for (const [idx, f] of files.entries()) {
                const linkedItem = insertedItems?.[idx];

                const rawKey = f.key || f.id;
                const proxyPath = rawKey ? `/api/files/${rawKey}` : null;
                let fileRecord: { id: string } | null = f.fileId ? { id: f.fileId } : null;

                if (!fileRecord && f.url) {
                    const { data } = await supabase
                        .from('files')
                        .select('id')
                        .eq('file_url', f.url)
                        .maybeSingle();
                    fileRecord = data || null;
                }

                if (!fileRecord && proxyPath) {
                    const { data } = await supabase
                        .from('files')
                        .select('id')
                        .eq('file_url', proxyPath)
                        .maybeSingle();
                    fileRecord = data || null;
                }

                if (!fileRecord && rawKey) {
                    const { data } = await supabase
                        .from('files')
                        .select('id')
                        .eq('file_url', rawKey)
                        .maybeSingle();
                    fileRecord = data || null;
                }

                if (fileRecord && linkedItem) {
                    // Create file_link: file â†’ order_item
                    const { error: linkError } = await supabase
                        .from('file_links')
                        .insert({
                            file_id: fileRecord.id,
                            ref_type: 'order_item',
                            ref_id: linkedItem.id,
                            tag: 'models',
                            metadata: { original_name: f.name },
                        });

                    if (linkError) {
                        console.error(`[PrintingOrder] Failed to create file_link for file=${f.id}:`, linkError);
                    }
                } else if (!fileRecord) {
                    // Fallback: create a new `files` record + link
                    console.warn(`[PrintingOrder] No existing file record for id=${f.id}, creating new one`);
                    const { data: newFile, error: insertError } = await supabase
                        .from('files')
                        .insert({
                            file_url: proxyPath || f.url || f.id,
                            mime_type: f.type || 'application/octet-stream',
                            size_bytes: f.size || 0,
                            provider: 'r2',
                            original_filename: f.name,
                            object_key: rawKey,
                            created_at: now,
                        })
                        .select('id')
                        .single();

                    if (insertError || !newFile) {
                        console.error(`[PrintingOrder] Fallback file INSERT failed (id=${f.id}):`, insertError);
                    } else if (linkedItem) {
                        await supabase
                            .from('file_links')
                            .insert({
                                file_id: newFile.id,
                                ref_type: 'order_item',
                                ref_id: linkedItem.id,
                                tag: 'models',
                                metadata: { original_name: f.name },
                            });
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
