import { createClient } from '@supabase/supabase-js';
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

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function archiveOrderFiles(orderId: string) {
    console.log(`[Archiver] Starting archive for order ${orderId}`);

    // 1. Fetch Order with Items
    const { data: order, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('id', orderId)
        .single();

    if (error || !order) {
        throw new Error(`Order not found: ${error?.message}`);
    }

    // Infer order type based on items
    const items = order.items || [];
    let order_type = 'ready_made';
    if (items.length > 0) {
        const conf = items[0].configuration || {};
        if (conf.print_tech) order_type = 'printing';
        else if (conf.style || conf.photos) order_type = 'custom';
    }

    const orderCode = order.order_code;
    const customerCode = order.user?.customer_code || 'CUS-UNKNOWN';

    // 2. Process Items
    for (const item of items) {
        if (!item.configuration) continue;

        // Custom Order Images
        if (order_type === 'custom') {
            const config = item.configuration as CustomConfig;
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
                await supabase.from('order_items').update({ configuration: config }).eq('id', item.id);
            }
        }

        // Printing Order Files
        if (order_type === 'printing') {
            const config = item.configuration as PrintingConfig;
            if (config.stl_file) {
                const file = config.stl_file;
                const r2Key = file.key || (file.drive_file_id && file.drive_file_id.includes('/') ? file.drive_file_id : null);

                if (r2Key) {
                    try {
                        const buffer = await downloadFromR2(r2Key);
                        const driveResult = await uploadWithNaming(
                            buffer,
                            file.file_name,
                            'application/octet-stream',
                            { type: 'printing', orderCode, customerCode, index: 1 }
                        );

                        config.stl_file = {
                            drive_file_id: driveResult.fileId,
                            file_name: driveResult.fileName,
                            web_view_link: driveResult.webViewLink
                        };

                        await deleteFromR2(r2Key);

                        await supabase.from('order_items').update({ configuration: config }).eq('id', item.id);
                        console.log(`[Archiver] Moved STL ${r2Key} to Drive`);

                    } catch (e) {
                        console.error(`[Archiver] Failed to archive STL ${r2Key}`, e);
                    }
                }
            }
        }
    }

    console.log(`[Archiver] Completed archive for ${orderId}`);
    return { success: true };
}
