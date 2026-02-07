/**
 * Migrate to Drive Service
 * 
 * Migrates files from R2 to Google Drive when order is completed.
 * Uses unified storage keys for consistent naming across R2 and Drive.
 * 
 * Flow:
 * 1. Order status → COMPLETED
 * 2. Find R2 files for this order
 * 3. Download from R2
 * 4. Upload to Google Drive (using same folder structure)
 * 5. Update database URLs
 * 6. Delete from R2 (keep customer folder empty)
 */

import { downloadFromR2, deleteFromR2, isR2Configured, isR2Url, extractR2KeyFromUrl } from './r2';
import { getAdminSupabase } from '../supabase/admin';
import { uploadToPath, isDriveConnected, getDirectUrl, buildFolderPath, uploadWithNaming } from '../google-drive-oauth';
import { parseUnifiedKey, isProductKey } from './unified-keys';

export interface MigrationResult {
    success: boolean;
    migratedFiles: number;
    errors: string[];
    orderId: string;
    newUrls?: Record<string, string>;
}

/**
 * Migrate order files from R2 to Google Drive
 * Called when order status changes to COMPLETED
 * 
 * NEW: Reads from order_files table instead of orders.image_urls
 */
export async function migrateOrderToArchive(orderId: string): Promise<MigrationResult> {
    const result: MigrationResult = {
        success: true,
        migratedFiles: 0,
        errors: [],
        orderId,
        newUrls: {},
    };

    // Skip if R2 not configured
    if (!isR2Configured()) {
        return result;
    }

    // Check if Drive is connected
    const driveConnected = await isDriveConnected();
    if (!driveConnected) {
        result.errors.push('Google Drive not connected, skipping migration');
        return result;
    }

    try {
        const supabase = getAdminSupabase();

        // 1. Get order info
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, order_code, order_type, user_id')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            result.success = false;
            result.errors.push(`Order not found: ${orderId}`);
            return result;
        }

        // 2. Get R2 files from order_files table (not yet archived)
        const { data: filesToMigrate, error: filesError } = await supabase
            .from('order_files')
            .select('id, file_key, file_name, mime_type, category, order_code')
            .eq('order_id', orderId)
            .eq('storage_provider', 'r2')
            .is('archived_at', null);

        if (filesError) {
            result.success = false;
            result.errors.push(`Failed to fetch order_files: ${filesError.message}`);
            return result;
        }

        if (!filesToMigrate || filesToMigrate.length === 0) {
            console.log(`[Migration] No R2 files to migrate for order ${order.order_code}`);
            return result;
        }

        console.log(`[Migration] Starting migration for order ${order.order_code}: ${filesToMigrate.length} files`);

        // 3. Migrate each file
        for (const file of filesToMigrate) {
            if (!file.file_key) {
                result.errors.push(`File ${file.id} has no file_key, skipping`);
                continue;
            }

            try {
                // Download from R2
                const buffer = await downloadFromR2(file.file_key);

                // Determine category for Drive folder
                const category = file.category || 'images';
                const ext = file.file_name?.split('.').pop()?.toLowerCase() || 'jpg';
                const mimeType = file.mime_type || (
                    ext === 'png' ? 'image/png' :
                        ext === 'webp' ? 'image/webp' :
                            ext === 'stl' ? 'model/stl' :
                                ext === 'obj' ? 'model/obj' :
                                    'image/jpeg'
                );

                // Upload to Drive with order-centric path
                const driveResult = await uploadWithNaming(
                    buffer,
                    file.file_name || `file_${file.id}.${ext}`,
                    mimeType,
                    {
                        type: 'order_centric',
                        index: 1,
                        orderCode: file.order_code || order.order_code,
                        category: category
                    }
                );

                const driveUrl = getDirectUrl(driveResult.fileId);

                // Update order_files record with Drive info and archive timestamp
                const { error: updateError } = await supabase
                    .from('order_files')
                    .update({
                        storage_provider: 'drive',
                        drive_file_id: driveResult.fileId,
                        drive_url: driveUrl,
                        archived_at: new Date().toISOString(),
                    })
                    .eq('id', file.id);

                if (updateError) {
                    result.errors.push(`Failed to update order_files ${file.id}: ${updateError.message}`);
                    continue;
                }

                // Delete from R2 after successful migration
                await deleteFromR2(file.file_key);

                result.migratedFiles++;
                result.newUrls![file.file_key] = driveUrl;
                console.log(`[Migration] Migrated: ${file.file_key} → ${driveUrl}`);

            } catch (fileError) {
                result.errors.push(`Failed to migrate ${file.file_key}: ${(fileError as Error).message}`);
            }
        }

        console.log(`[Migration] Complete: ${result.migratedFiles} files migrated for order ${order.order_code}`);

        return result;

    } catch (error) {
        result.success = false;
        result.errors.push((error as Error).message);
        return result;
    }
}
