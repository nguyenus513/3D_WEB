/**
 * File Access Security Module
 * 
 * Provides ownership checking and audit logging for R2 files.
 * Ensures User A cannot access User B's files.
 */

import { getAdminSupabase } from '@/lib/supabase/admin';
import { extractOrderCodeFromKey } from '@/lib/storage/order-storage';

export interface FileAccessCheck {
    allowed: boolean;
    reason?: string;
    fileId?: string;
    isPublic?: boolean;
}

export interface FileAccessLogEntry {
    fileKey: string;
    fileId?: string;
    userId?: string;
    action: 'view' | 'download' | 'delete';
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    deniedReason?: string;
}

/**
 * Check if a user can access a file
 */
export async function canAccessFile(
    userId: string | null,
    fileKey: string,
    userRole?: string
): Promise<FileAccessCheck> {
    const supabase = getAdminSupabase();

    // Admin can access everything
    if (userRole === 'admin') {
        return { allowed: true, reason: 'admin' };
    }

    // No user = only public files
    if (!userId) {
        // Check if it's a public file (product images)
        if (fileKey.startsWith('products/')) {
            return { allowed: true, reason: 'public_product', isPublic: true };
        }
        return { allowed: false, reason: 'unauthenticated' };
    }

    // Check file in database
    type OrderFileRow = {
        id: string;
        order_id: string | null;
        owner_id: string | null;
        allowed_user_ids: string[] | null;
        is_public: boolean | null;
        file_key: string;
        storage_provider?: string | null;
    };

    const { data: fileData } = await supabase
        .from('order_files')
        .select('id, order_id, owner_id, allowed_user_ids, is_public, file_key, storage_provider')
        .eq('file_key', fileKey)
        .single();
    const file = (fileData || null) as OrderFileRow | null;

    // File not tracked in DB - check by path pattern
    if (!file) {
        // Product images are public
        if (fileKey.startsWith('products/')) {
            return { allowed: true, reason: 'public_product', isPublic: true };
        }

        // Order files - check if user owns the order by extracting order code
        const orderCode = extractOrderCodeFromKey(fileKey);
        if (orderCode) {
        const { data: order } = await supabase
            .from('orders')
            .select('user_id, archived_at')
            .eq('order_code', orderCode)
            .single();

        if (order?.archived_at) {
            return { allowed: false, reason: 'archived' };
        }

        if (order?.user_id === userId) {
            return { allowed: true, reason: 'order_owner' };
        }
        }

        return { allowed: false, reason: 'file_not_found' };
    }

    // Archived files moved to Drive: block non-admin access
    if (file.storage_provider === 'drive') {
        return { allowed: false, reason: 'archived', fileId: file.id };
    }

    if (file.order_id) {
        const { data: order } = await supabase
            .from('orders')
            .select('archived_at, user_id')
            .eq('id', file.order_id)
            .single();
        if (order?.archived_at) {
            return { allowed: false, reason: 'archived', fileId: file.id };
        }
        if (order?.user_id === userId) {
            return { allowed: true, reason: 'order_owner', fileId: file.id };
        }
    }

    // Public files
    if (file.is_public) {
        return { allowed: true, reason: 'public', fileId: file.id, isPublic: true };
    }

    // Owner check
    if (file.owner_id === userId) {
        return { allowed: true, reason: 'owner', fileId: file.id };
    }

    // Allowed users array check
    if (file.allowed_user_ids?.includes(userId)) {
        return { allowed: true, reason: 'allowed_user', fileId: file.id };
    }

    return { allowed: false, reason: 'unauthorized', fileId: file.id };
}

/**
 * Log file access attempt
 */
export async function logFileAccess(entry: FileAccessLogEntry): Promise<void> {
    try {
        const supabase = getAdminSupabase();

        await supabase
            .from('file_access_logs')
            .insert({
                file_key: entry.fileKey,
                file_id: entry.fileId || null,
                user_id: entry.userId || null,
                action: entry.action,
                ip_address: entry.ipAddress || null,
                user_agent: entry.userAgent || null,
                success: entry.success,
                denied_reason: entry.deniedReason || null,
            });
    } catch (error) {
        // Don't fail the request if logging fails
        console.error('[Security] Failed to log file access:', error);
    }
}

/**
 * Get file owner from database
 */
export async function getFileOwner(fileKey: string): Promise<string | null> {
    const supabase = getAdminSupabase();

    const { data } = await supabase
        .from('order_files')
        .select('owner_id')
        .eq('file_key', fileKey)
        .single();

    return data?.owner_id || null;
}

/**
 * Track file upload with ownership
 */
export async function trackFileUpload(
    fileKey: string,
    ownerId: string,
    options?: {
        orderId?: string;
        orderCode?: string;
        isPublic?: boolean;
        allowedUserIds?: string[];
        fileName?: string;
        fileType?: string;
        storageProvider?: 'r2' | 'drive';
    }
): Promise<void> {
    try {
        const supabase = getAdminSupabase();
        const isUuid = (value?: string | null) => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        const normalizedOrderId = isUuid(options?.orderId) ? options?.orderId : null;

        await supabase
            .from('order_files')
            .insert({
                file_key: fileKey,
                file_id: fileKey, // legacy compatibility
                order_id: normalizedOrderId,
                order_code: options?.orderCode || null,
                owner_id: ownerId,
                is_public: options?.isPublic || false,
                allowed_user_ids: options?.allowedUserIds || [],
                file_name: options?.fileName || null,
                file_type: options?.fileType || null,
                storage_provider: options?.storageProvider || 'r2',
            });
    } catch (error) {
        // Don't fail upload if tracking fails (table might not exist)
        console.warn('[FileAccess] Failed to track file upload:', error);
    }
}

/**
 * Grant access to additional users
 */
export async function grantFileAccess(
    fileKey: string,
    userIds: string[]
): Promise<void> {
    const supabase = getAdminSupabase();

    // Get current allowed users
    const { data } = await supabase
        .from('order_files')
        .select('allowed_user_ids')
        .eq('file_key', fileKey)
        .single();

    const currentAllowed = data?.allowed_user_ids || [];
    const newAllowed = [...new Set([...currentAllowed, ...userIds])];

    await supabase
        .from('order_files')
        .update({ allowed_user_ids: newAllowed })
        .eq('file_key', fileKey);
}

/**
 * Revoke access from users
 */
export async function revokeFileAccess(
    fileKey: string,
    userIds: string[]
): Promise<void> {
    const supabase = getAdminSupabase();

    const { data } = await supabase
        .from('order_files')
        .select('allowed_user_ids')
        .eq('file_key', fileKey)
        .single();

    const currentAllowed = data?.allowed_user_ids || [];
    const newAllowed = currentAllowed.filter((id: string) => !userIds.includes(id));

    await supabase
        .from('order_files')
        .update({ allowed_user_ids: newAllowed })
        .eq('file_key', fileKey);
}
