/**
 * File Access Security Module
 * 
 * Provides ownership checking and audit logging for R2 files.
 * Ensures User A cannot access User B's files.
 * 
 * Uses actual DB tables: `files` + `file_links` (polymorphic).
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
 * Check if a user can access a file by its storage key
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

    // Check file in database via files table (match by file_url)
    const proxyUrl = `/api/files/${fileKey}`;
    const { data: file } = await supabase
        .from('files')
        .select('id, file_url')
        .or(`file_url.eq.${proxyUrl},file_url.eq.${fileKey}`)
        .maybeSingle();

    // File not tracked in DB - check by path pattern
    if (!file) {
        // Product images are public
        if (fileKey.startsWith('products/')) {
            return { allowed: true, reason: 'public_product', isPublic: true };
        }

        // Order files - check by path pattern
        // Pattern: orders/{order_code}/... (e.g. orders/DF637513/demo/...)
        const orderMatch = fileKey.match(/orders\/([^/]+)\//);
        if (orderMatch) {
            const orderCode = orderMatch[1];
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .select('user_id')
                .eq('order_code', orderCode)
                .maybeSingle();

            if (orderError) {
                console.warn('[FileAccess] Order lookup error:', orderError.message, { fileKey, orderCode });
            }

            if (order?.user_id === userId) {
                return { allowed: true, reason: 'order_owner' };
            }

            // Log mismatch for debugging
            if (order) {
                console.warn('[FileAccess] Owner mismatch', {
                    fileKey,
                    sessionUserId: userId,
                    orderUserId: order.user_id,
                });
            }
        }

        return { allowed: false, reason: 'file_not_found' };
    }

    // File found in DB - check ownership via file_links
    const { data: links } = await supabase
        .from('file_links')
        .select('ref_type, ref_id')
        .eq('file_id', file.id);

    if (links && links.length > 0) {
        for (const link of links) {
            if (link.ref_type === 'order' || link.ref_type === 'order_item') {
                // Check if user owns the linked order
                const tableName = link.ref_type === 'order' ? 'orders' : 'order_items';

                if (link.ref_type === 'order') {
                    const { data: order } = await supabase
                        .from('orders')
                        .select('user_id')
                        .eq('id', link.ref_id)
                        .single();
                    if (order?.user_id === userId) {
                        return { allowed: true, reason: 'order_owner', fileId: file.id };
                    }
                } else {
                    // order_item → get order → check user_id
                    const { data: item } = await supabase
                        .from('order_items')
                        .select('order_id')
                        .eq('id', link.ref_id)
                        .single();
                    if (item?.order_id) {
                        const { data: order } = await supabase
                            .from('orders')
                            .select('user_id')
                            .eq('id', item.order_id)
                            .single();
                        if (order?.user_id === userId) {
                            return { allowed: true, reason: 'order_owner', fileId: file.id };
                        }
                    }
                }
            }
        }
    }

    return { allowed: false, reason: 'unauthorized', fileId: file.id };
}

/**
 * Check if a user can access a file by ID
 */
export async function canAccessFileById(
    userId: string | null,
    fileId: string,
    userRole?: string
): Promise<FileAccessCheck> {
    const supabase = getAdminSupabase();

    // Admin can access everything
    if (userRole === 'admin') {
        return { allowed: true, reason: 'admin', fileId };
    }

    // No user = only public files
    if (!userId) {
        return { allowed: false, reason: 'unauthenticated' };
    }

    // Check file exists
    const { data: file } = await supabase
        .from('files')
        .select('id, file_url')
        .eq('id', fileId)
        .single();

    if (!file) {
        return { allowed: false, reason: 'file_not_found' };
    }

    // Check ownership via file_links
    const { data: links } = await supabase
        .from('file_links')
        .select('ref_type, ref_id')
        .eq('file_id', fileId);

    if (links && links.length > 0) {
        for (const link of links) {
            if (link.ref_type === 'order') {
                const { data: order } = await supabase
                    .from('orders')
                    .select('user_id')
                    .eq('id', link.ref_id)
                    .single();
                if (order?.user_id === userId) {
                    return { allowed: true, reason: 'order_owner', fileId };
                }
            } else if (link.ref_type === 'order_item') {
                const { data: item } = await supabase
                    .from('order_items')
                    .select('order_id')
                    .eq('id', link.ref_id)
                    .single();
                if (item?.order_id) {
                    const { data: order } = await supabase
                        .from('orders')
                        .select('user_id')
                        .eq('id', item.order_id)
                        .single();
                    if (order?.user_id === userId) {
                        return { allowed: true, reason: 'order_owner', fileId };
                    }
                }
            }
        }
    }

    return { allowed: false, reason: 'unauthorized', fileId };
}

/**
 * Log file access attempt (console-only, no DB table)
 */
export async function logFileAccess(entry: FileAccessLogEntry): Promise<void> {
    try {
        // file_access_logs table does not exist — log to console only
        if (!entry.success) {
            console.warn('[Security] File access denied:', {
                fileKey: entry.fileKey,
                userId: entry.userId,
                action: entry.action,
                reason: entry.deniedReason,
            });
        }
    } catch (error) {
        console.error('[Security] Failed to log file access:', error);
    }
}

/**
 * Get file owner from database via file_links
 */
export async function getFileOwner(fileKey: string): Promise<string | null> {
    const supabase = getAdminSupabase();

    // Find file by URL pattern
    const proxyUrl = `/api/files/${fileKey}`;
    const { data: file } = await supabase
        .from('files')
        .select('id')
        .or(`file_url.eq.${proxyUrl},file_url.eq.${fileKey}`)
        .maybeSingle();

    if (!file) return null;

    // Find linked order and get user_id
    const { data: link } = await supabase
        .from('file_links')
        .select('ref_type, ref_id')
        .eq('file_id', file.id)
        .eq('ref_type', 'order')
        .maybeSingle();

    if (!link) return null;

    const { data: order } = await supabase
        .from('orders')
        .select('user_id')
        .eq('id', link.ref_id)
        .single();

    return order?.user_id || null;
}

/**
 * Track file upload with ownership — inserts into `files` + `file_links`
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
    try {
        const supabase = getAdminSupabase();

        const fileUrl = `/api/files/${fileKey}`;

        // Insert into files table
        const { data: inserted, error } = await supabase
            .from('files')
            .insert({
                file_url: fileUrl,
                mime_type: options?.fileType || 'application/octet-stream',
                size_bytes: 0, // Size not available at this point
                provider: 'r2',
            })
            .select('id')
            .single();

        if (error || !inserted) {
            console.warn('[FileAccess] Failed to track file upload (files insert):', error);
            return;
        }

        // Create file_link if we have an order
        if (orderId) {
            const { error: linkError } = await supabase
                .from('file_links')
                .insert({
                    file_id: inserted.id,
                    ref_type: 'order',
                    ref_id: orderId,
                    tag: 'upload',
                });

            if (linkError) {
                console.warn('[FileAccess] Failed to create file_link:', linkError);
            }
        }
    } catch (error) {
        // Don't fail upload if tracking fails
        console.warn('[FileAccess] Failed to track file upload:', error);
    }
}
