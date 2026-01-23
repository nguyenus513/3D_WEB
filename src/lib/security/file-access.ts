/**
 * File Access Security Module
 * 
 * Provides ownership checking and audit logging for R2 files.
 * Ensures User A cannot access User B's files.
 */

import { getAdminSupabase } from '@/lib/supabase/admin';

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
    const { data: file } = await supabase
        .from('order_files')
        .select('id, order_id, owner_id, allowed_user_ids, is_public, file_key')
        .eq('file_key', fileKey)
        .single();

    // File not tracked in DB - check by path pattern
    if (!file) {
        // Product images are public
        if (fileKey.startsWith('products/')) {
            return { allowed: true, reason: 'public_product', isPublic: true };
        }

        // Order files - check if user owns the order by extracting order code
        const orderMatch = fileKey.match(/orders\/([^/]+)\//);
        if (orderMatch) {
            const orderCode = orderMatch[1];
            const { data: order } = await supabase
                .from('orders')
                .select('user_id')
                .eq('order_code', orderCode)
                .single();

            if (order?.user_id === userId) {
                return { allowed: true, reason: 'order_owner' };
            }
        }

        return { allowed: false, reason: 'file_not_found' };
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

    // Check if user owns the order
    if (file.order_id) {
        const { data: order } = await supabase
            .from('orders')
            .select('user_id')
            .eq('id', file.order_id)
            .single();

        if (order?.user_id === userId) {
            return { allowed: true, reason: 'order_owner', fileId: file.id };
        }
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
    orderId?: string,
    options?: {
        isPublic?: boolean;
        allowedUserIds?: string[];
        fileName?: string;
        fileType?: string;
    }
): Promise<void> {
    const supabase = getAdminSupabase();

    await supabase
        .from('order_files')
        .insert({
            file_key: fileKey,
            order_id: orderId || null,
            owner_id: ownerId,
            is_public: options?.isPublic || false,
            allowed_user_ids: options?.allowedUserIds || [],
            file_name: options?.fileName || null,
            file_type: options?.fileType || null,
        });
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
