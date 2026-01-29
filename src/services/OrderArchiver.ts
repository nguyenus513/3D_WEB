import { createClient } from '@supabase/supabase-js';
import { uploadWithNaming } from '@/lib/google-drive-oauth';
import { downloadFromR2, deleteFromR2 } from '@/lib/storage/r2';
import { Order, CustomConfig, PrintingConfig } from '@/types/database';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Archive Order Files
 * Moves files from R2 (Hot) to Google Drive (Cold/Archive)
 */
export async function archiveOrderFiles(orderId: string) {
    console.log(`[Archiver] Starting archive for order ${orderId}`);

    // 1. Fetch Order with Items
    const { data: order, error } = await supabase
        .from('orders')
        .select('*, items(*)')
        .eq('id', orderId)
        .single();

    if (error || !order) {
        throw new Error(`Order not found: ${error?.message}`);
    }

    const { order_type, items } = order as Order;
    const orderCode = order.order_code;
    const customerCode = order.user?.customer_code || 'CUS-UNKNOWN';

    // 2. Process Items
    for (const item of items || []) {
        if (!item.configuration) continue;

        // Custom Order Images
        if (order_type === 'custom') {
            const config = item.configuration as CustomConfig;
            for (let i = 0; i < config.photos.length; i++) {
                const photo = config.photos[i];

                // If it has 'key' property, it's explicitly R2. 
                // If 'drive_file_id' contains '/', it's likely an R2 key (e.g. orders/123/img.jpg)
                // If 'drive_file_id' is alphanumeric only, it's a Drive ID.
                const r2Key = (photo as any).key || (photo.drive_file_id && photo.drive_file_id.includes('/') ? photo.drive_file_id : null);

                if (r2Key) {
                    console.log(`[Archiver] Processing photo: ${r2Key}`);
                    try {
                        // Download from R2
                        const buffer = await downloadFromR2(r2Key);

                        // Determine Drive path/name
                        const driveType = 'custom_main'; // Simplification for now

                        // Upload to Drive
                        const driveResult = await uploadWithNaming(
                            buffer,
                            photo.file_name,
                            'image/jpeg', // Default or detect
                            {
                                type: driveType,
                                orderCode,
                                customerCode,
                                index: i + 1
                            }
                        );

                        // Update Config
                        config.photos[i] = {
                            drive_file_id: driveResult.fileId,
                            file_name: driveResult.fileName,
                            web_view_link: driveResult.webViewLink
                        };

                        // Delete from R2
                        await deleteFromR2(r2Key);
                        console.log(`[Archiver] Moved ${r2Key} to Drive ${driveResult.fileId}`);
                    } catch (e) {
                        console.error(`[Archiver] Failed to archive ${r2Key}`, e);
                    }
                }
            }

            // Save updated config
            await supabase
                .from('order_items')
                .update({ configuration: config })
                .eq('id', item.id);
        }

        // Printing Order Files
        if (order_type === 'printing') {
            const config = item.configuration as PrintingConfig;
            const file = config.stl_file;
            const r2Key = (file as any).key || (file.drive_file_id && file.drive_file_id.includes('/') ? file.drive_file_id : null);

            if (r2Key) {
                try {
                    const buffer = await downloadFromR2(r2Key);
                    const driveResult = await uploadWithNaming(
                        buffer,
                        file.file_name,
                        'application/octet-stream', // STL default
                        {
                            type: 'printing',
                            orderCode,
                            customerCode,
                            index: 1
                        }
                    );

                    config.stl_file = {
                        drive_file_id: driveResult.fileId,
                        file_name: driveResult.fileName,
                        web_view_link: driveResult.webViewLink
                    };

                    await deleteFromR2(r2Key);

                    await supabase
                        .from('order_items')
                        .update({ configuration: config })
                        .eq('id', item.id);

                    console.log(`[Archiver] Moved STL ${r2Key} to Drive`);

                } catch (e) {
                    console.error(`[Archiver] Failed to archive STL ${r2Key}`, e);
                }
            }
        }
    }

    console.log(`[Archiver] Completed archive for ${orderId}`);
    return { success: true };
}
