import { getAdminSupabase } from '@/lib/supabase/admin';
import { uploadWithNaming } from '@/lib/google-drive-oauth';
import { downloadFromR2, deleteFromR2 } from '@/lib/storage/r2';
// Define Interfaces Locally as they are not exported from database types anymore
interface CustomConfig {
    photos: Array<{
        drive_file_id: string;
        file_name: string;
        web_view_link?: string;
        key?: string;
    }>;
}

interface PrintingConfig {
    stl_file: {
        drive_file_id: string;
        file_name: string;
        web_view_link?: string;
        key?: string;
    };
}

const supabase = getAdminSupabase();

export async function archiveOrderFiles(orderId: string) {
    console.log(`[Archiver] Starting archive for order ${orderId}`);

    // 1. Fetch Order with Items + Files
    const { data: order, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*), files:order_files(*)')
        .eq('id', orderId)
        .single();

    if (error || !order) {
        throw new Error(`Order not found: ${error?.message}`);
    }

    // Infer order type
    const items = order.items || [];
    const orderFiles = order.files || [];
    let order_type = order.order_type || 'ready_made';
    if (order_type !== 'custom' && order_type !== 'printing' && order_type !== 'print_3d') {
        // Fallback: infer from items
        if (items.length > 0) {
            const spec = items[0].spec || {};
            if (spec.print_tech || items[0].item_type === 'print_3d') order_type = 'print_3d';
            else if (spec.style || spec.photos) order_type = 'custom';
        }
    }

    const orderCode = order.order_code;
    const customerCode = order.user?.customer_code || 'CUS-UNKNOWN';

    // 2. Process Items
    for (const item of items) {
        const itemSpec = item.spec || item.configuration || {};

        // Custom Order Images
        if (order_type === 'custom') {
            const config = (itemSpec as CustomConfig);
            if (config.photos && Array.isArray(config.photos)) {
                for (let i = 0; i < config.photos.length; i++) {
                    const photo = config.photos[i];
                    // If it has 'key' property, it's explicitly R2. 
                    const r2Key = photo.key || (photo.drive_file_id && photo.drive_file_id.includes('/') ? photo.drive_file_id : null);

                    if (r2Key) {
                        try {
                            const buffer = await downloadFromR2(r2Key);
                            const driveResult = await uploadWithNaming(
                                buffer,
                                photo.file_name,
                                'image/jpeg',
                                { type: 'custom_main', orderCode, customerCode, index: i + 1 }
                            );

                            config.photos[i] = {
                                drive_file_id: driveResult.fileId,
                                file_name: driveResult.fileName,
                                web_view_link: driveResult.webViewLink
                            };

                            await deleteFromR2(r2Key);
                            console.log(`[Archiver] Moved ${r2Key} to Drive ${driveResult.fileId}`);
                        } catch (e) {
                            console.error(`[Archiver] Failed to archive ${r2Key}`, e);
                        }
                    }
                }
                // Save updated config
                await supabase.from('order_items').update({ spec: config }).eq('id', item.id);
            }
        }

        // Printing Order Files — use order_files table
        if (order_type === 'printing' || order_type === 'print_3d') {
            // Find files for this item from order_files table
            const itemFiles = orderFiles.filter((f: any) => f.order_item_id === item.id);
            for (const file of itemFiles) {
                const r2Key = file.file_key;
                if (!r2Key) continue;

                try {
                    const buffer = await downloadFromR2(r2Key);
                    const driveResult = await uploadWithNaming(
                        buffer,
                        file.file_name || 'model.stl',
                        'application/octet-stream',
                        { type: 'printing', orderCode, customerCode, index: 1 }
                    );

                    // Update order_files record with Drive info
                    await supabase.from('order_files').update({
                        storage_provider: 'drive',
                        file_url: driveResult.webViewLink,
                    }).eq('id', file.id);

                    await deleteFromR2(r2Key);
                    console.log(`[Archiver] Moved ${r2Key} to Drive ${driveResult.fileId}`);
                } catch (e) {
                    console.error(`[Archiver] Failed to archive ${r2Key}`, e);
                }
            }
        }
    }

    console.log(`[Archiver] Completed archive for ${orderId}`);
    return { success: true };
}


