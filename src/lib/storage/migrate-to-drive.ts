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

        // 1. Get order with file URLs
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, order_code, order_type, image_urls, file_url, user_id')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            result.success = false;
            result.errors.push(`Order not found: ${orderId}`);
            return result;
        }

        // Get customer code for folder naming
        let customerCode = 'GUEST';
        if (order.user_id) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('customer_code')
                .eq('id', order.user_id)
                .single();
            customerCode = profile?.customer_code || 'GUEST';
        }

        // 2. Collect R2 URLs to migrate
        const filesToMigrate: { url: string; type: 'image' | 'file'; index: number }[] = [];

        // Parse image_urls (can be array or JSON string)
        let imageUrls: string[] = [];
        if (order.image_urls) {
            if (Array.isArray(order.image_urls)) {
                imageUrls = order.image_urls;
            } else if (typeof order.image_urls === 'string') {
                try {
                    imageUrls = JSON.parse(order.image_urls);
                } catch {
                    imageUrls = [order.image_urls];
                }
            }
        }

        imageUrls.forEach((url, index) => {
            if (url && isR2Url(url)) {
                filesToMigrate.push({ url, type: 'image', index: index + 1 });
            }
        });

        if (filesToMigrate.length === 0) {
            // No R2 files to migrate
            return result;
        }

        console.log(`[Migration] Starting migration for order ${order.order_code}: ${filesToMigrate.length} files`);

        // 3. Migrate each file
        const newImageUrls: string[] = [...imageUrls];

        for (const file of filesToMigrate) {
            try {
                const r2Key = extractR2KeyFromUrl(file.url);
                if (!r2Key) {
                    result.errors.push(`Could not extract key from URL: ${file.url}`);
                    continue;
                }

                // Download from R2
                const buffer = await downloadFromR2(r2Key);

                // Determine MIME type from URL
                const ext = file.url.split('.').pop()?.toLowerCase() || 'jpg';
                const mimeType = ext === 'png' ? 'image/png' :
                    ext === 'webp' ? 'image/webp' : 'image/jpeg';

                // Upload to Drive
                const uploadType = order.order_type === 'printing' ? 'printing' : 'custom_main';
                const driveResult = await uploadWithNaming(
                    buffer,
                    `archived_${file.index}.${ext}`,
                    mimeType,
                    {
                        type: uploadType,
                        index: file.index,
                        customerCode,
                        orderCode: order.order_code,
                    }
                );

                const driveUrl = getDirectUrl(driveResult.fileId);

                // Update URL in array
                const originalIndex = imageUrls.indexOf(file.url);
                if (originalIndex !== -1) {
                    newImageUrls[originalIndex] = driveUrl;
                }

                // Delete from R2
                await deleteFromR2(r2Key);

                result.migratedFiles++;
                console.log(`[Migration] Migrated: ${file.url} → ${driveUrl}`);

            } catch (fileError) {
                result.errors.push(`Failed to migrate ${file.url}: ${(fileError as Error).message}`);
            }
        }

        // 4. Update database with new URLs
        if (result.migratedFiles > 0) {
            const { error: updateError } = await supabase
                .from('orders')
                .update({ image_urls: newImageUrls })
                .eq('id', orderId);

            if (updateError) {
                result.errors.push(`Failed to update database: ${updateError.message}`);
                result.success = false;
            } else {
                result.newUrls = { image_urls: JSON.stringify(newImageUrls) };
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
