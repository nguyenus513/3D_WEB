/**
 * Notification Helper Library
 * Creates notifications for SaaS-grade event tracking.
 *
 * Usage:
 *   await createNotification({
 *     userId: 'uuid',
 *     title: 'Khách đã duyệt thiết kế',
 *     type: 'design_approved',
 *     refId: orderId,
 *     refType: 'order',
 *   });
 */

import { getAdminSupabase } from '@/lib/supabase/admin';

export type NotificationType =
    | 'design_approved'
    | 'design_rejected'
    | 'design_uploaded'
    | 'order_status'
    | 'payment';

export type RefType = 'order' | 'design_version';

interface CreateNotificationParams {
    userId: string;
    title: string;
    message?: string;
    type: NotificationType;
    refId?: string;
    refType?: RefType;
}

/**
 * Create a single notification for a user.
 * Uses admin client to bypass RLS.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
    const supabase = getAdminSupabase();

    const { error } = await supabase
        .from('notifications')
        .insert({
            user_id: params.userId,
            title: params.title,
            message: params.message || null,
            type: params.type,
            ref_id: params.refId || null,
            ref_type: params.refType || null,
        });

    if (error) {
        console.error('[Notification] Failed to create:', error.message, params);
    }
}

/**
 * Notify all admin users about an event.
 * Queries users with role='admin' and creates a notification for each.
 */
export async function notifyAllAdmins(params: Omit<CreateNotificationParams, 'userId'>): Promise<void> {
    const supabase = getAdminSupabase();

    // Fetch all admin user IDs
    const { data: admins, error } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');

    if (error || !admins?.length) {
        console.error('[Notification] Failed to fetch admins:', error?.message);
        return;
    }

    // Create notification for each admin
    const notifications = admins.map(admin => ({
        user_id: admin.id,
        title: params.title,
        message: params.message || null,
        type: params.type,
        ref_id: params.refId || null,
        ref_type: params.refType || null,
    }));

    const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

    if (insertError) {
        console.error('[Notification] Failed to notify admins:', insertError.message);
    }
}
