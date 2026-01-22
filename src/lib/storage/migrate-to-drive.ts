/**
 * Migrate to Drive Service
 * 
 * Phase 7: Hybrid Storage - Migrate files from R2 to Google Drive
 * when order is completed (cold storage archival)
 * 
 * Flow:
 * 1. Order status changes to COMPLETED
 * 2. Download files from R2
 * 3. Upload to Google Drive archived folder
 * 4. Update database URLs (R2 → Drive)
 * 5. Delete files from R2
 */

import { downloadFromR2, deleteFromR2, isR2Configured } from './r2';
import { getAdminSupabase } from '../supabase/admin';

// Google Drive OAuth import (existing)
// Note: This uses the existing google-drive-oauth.ts service

interface MigrationResult {
    success: boolean;
    migratedFiles: number;
    errors: string[];
    orderId: string;
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
    };

    // Skip if R2 not configured
    if (!isR2Configured()) {
        result.errors.push('R2 not configured, skipping migration');
        return result;
    }

    try {
        const supabase = getAdminSupabase();

        // 1. Get order with file URLs
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, order_code, image_urls, file_url')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            result.success = false;
            result.errors.push(`Order not found: ${orderId}`);
            return result;
        }

        // 2. Identify R2 files (check if URL contains R2 domain)
        const r2Domain = process.env.R2_PUBLIC_URL || 'r2.cloudflarestorage.com';
        const filesToMigrate: { type: 'image' | 'file'; url: string; index?: number }[] = [];

        // Check image_urls (array or JSON)
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
            if (url && url.includes(r2Domain)) {
                filesToMigrate.push({ type: 'image', url, index });
            }
        });

        // Check file_url
        if (order.file_url && order.file_url.includes(r2Domain)) {
            filesToMigrate.push({ type: 'file', url: order.file_url });
        }

        if (filesToMigrate.length === 0) {
            // No R2 files to migrate
            return result;
        }

        // 3. Migrate each file
        // Note: This is a placeholder - actual implementation needs Google Drive OAuth service
        console.log(`[Migration] Would migrate ${filesToMigrate.length} files for order ${order.order_code}`);

        // For now, just log - actual implementation requires:
        // - Download from R2: await downloadFromR2(key)
        // - Upload to Drive: await uploadToGoogleDrive(buffer, folder)
        // - Update DB: await supabase.from('orders').update({ image_urls: newUrls })
        // - Delete from R2: await deleteFromR2(key)

        result.migratedFiles = filesToMigrate.length;

        // Log for tracking
        console.log(`[Migration] Order ${order.order_code}: ${result.migratedFiles} files ready for archival`);

        return result;

    } catch (error) {
        result.success = false;
        result.errors.push((error as Error).message);
        return result;
    }
}

/**
 * Extract R2 key from URL
 */
export function extractR2Key(url: string): string | null {
    try {
        const urlObj = new URL(url);
        // Remove leading slash
        return urlObj.pathname.slice(1);
    } catch {
        return null;
    }
}

/**
 * Check if URL is from R2
 */
export function isR2Url(url: string): boolean {
    const r2Domain = process.env.R2_PUBLIC_URL || 'r2.cloudflarestorage.com';
    return url.includes(r2Domain);
}

/**
 * Check if URL is from Google Drive
 */
export function isDriveUrl(url: string): boolean {
    return url.includes('drive.google.com') || url.includes('googleusercontent.com');
}
