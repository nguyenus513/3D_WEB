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

async function findTrackedFile(fileKey: string) {
    const supabase = getAdminSupabase();
    const proxyUrl = `/api/files/${fileKey}`;
    const candidates = [
        { column: 'file_url', value: proxyUrl },
        { column: 'file_url', value: fileKey },
        { column: 'object_key', value: fileKey },
        { column: 'file_key', value: fileKey },
    ];

    for (const candidate of candidates) {
        const { data, error } = await supabase
            .from('files')
            .select('id, file_url, owner_id')
            .eq(candidate.column, candidate.value)
            .maybeSingle();
        if (!error && data) return data;
    }

    return null;
}

function getOrderCodeCandidates(fileKey: string): string[] {
    const candidates = new Set<string>();
    const orderMatch = fileKey.match(/orders\/([^/]+)\//);
    if (orderMatch?.[1]) candidates.add(orderMatch[1]);

    const legacyMatch = fileKey.match(/^[^/]+\/\d{4}-\d{2}-\d{2}\/([^/]+)\//);
    if (legacyMatch?.[1]) candidates.add(legacyMatch[1]);

    const basename = fileKey.split('/').pop() || '';
    const basenameCode = basename.match(/^([0-9A-Fa-f]{8,})[-_.]/)?.[1];
    if (basenameCode) candidates.add(basenameCode);

    return [...candidates].map(code => code.toUpperCase());
}

async function canAccessByOrderCode(userId: string, fileKey: string): Promise<FileAccessCheck | null> {
    const supabase = getAdminSupabase();
    for (const orderCode of getOrderCodeCandidates(fileKey)) {
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, user_id')
            .eq('order_code', orderCode)
            .maybeSingle();

        if (orderError) {
            console.warn('[FileAccess] Order lookup error:', orderError.message, { fileKey, orderCode });
            continue;
        }

        if (order?.user_id === userId) {
            return { allowed: true, reason: 'order_owner' };
        }
    }

    return null;
}

async function canAccessDesignImage(userId: string, fileKey: string, fileId?: string): Promise<FileAccessCheck | null> {
    const supabase = getAdminSupabase();
    const proxyUrl = `/api/files/${fileKey}`;
    const { data: image } = await supabase
        .from('design_images')
        .select('id, version_id')
        .eq('image_url', proxyUrl)
        .maybeSingle();

    if (!image?.version_id) return null;

    const { data: version } = await supabase
        .from('design_versions')
        .select('order_id')
        .eq('id', image.version_id)
        .maybeSingle();

    if (!version?.order_id) return null;

    const { data: order } = await supabase
        .from('orders')
        .select('user_id')
        .eq('id', version.order_id)
        .maybeSingle();

    if (order?.user_id === userId) {
        return { allowed: true, reason: 'design_image_owner', fileId };
    }

    return null;
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

    // Product images are always public — regardless of auth status
    if (fileKey.startsWith('products/')) {
        return { allowed: true, reason: 'public_product', isPublic: true };
    }

    // No user = deny non-public files
    if (!userId) {
        return { allowed: false, reason: 'unauthenticated' };
    }

    // Check file in database via files table (match proxy URL and raw R2 key)
    const file = await findTrackedFile(fileKey);

    // File not tracked in DB - check by path pattern
    if (!file) {
        const orderAccess = await canAccessByOrderCode(userId, fileKey);
        if (orderAccess) return orderAccess;

        const designImageAccess = await canAccessDesignImage(userId, fileKey);
        if (designImageAccess) return designImageAccess;

        return { allowed: false, reason: 'file_not_found' };
    }

    if (file.owner_id === userId) {
        return { allowed: true, reason: 'file_owner', fileId: file.id };
    }

    // File found in DB - check ownership via file_links
    const { data: links } = await supabase
        .from('file_links')
        .select('ref_type, ref_id')
        .eq('file_id', file.id);

    if (links && links.length > 0) {
        for (const link of links) {
            if (link.ref_type === 'order' || link.ref_type === 'order_item') {
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

    const designImageAccess = await canAccessDesignImage(userId, fileKey, file.id);
    if (designImageAccess) return designImageAccess;

    const orderAccess = await canAccessByOrderCode(userId, fileKey);
    if (orderAccess) return { ...orderAccess, fileId: file.id };

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
): Promise<string | null> {
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
            const { data: existing } = await supabase
                .from('files')
                .select('id')
                .eq('file_url', fileUrl)
                .maybeSingle();
            return existing?.id || null;
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
        return inserted.id;
    } catch (error) {
        // Don't fail upload if tracking fails
        console.warn('[FileAccess] Failed to track file upload:', error);
        return null;
    }
}
