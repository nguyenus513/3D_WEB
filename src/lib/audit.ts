/**
 * Admin Audit Logger
 *
 * Records admin actions to the audit log table.
 * Used in admin API routes for accountability tracking.
 *
 * Usage:
 *   import { auditLog } from '@/lib/audit';
 *   await auditLog(adminId, 'UPDATE_ORDER_STATUS', 'order', orderId, { status: 'shipped' }, request);
 */

import { getAdminSupabase } from '@/lib/supabase/admin';

type AuditAction =
    | 'CREATE_ORDER'
    | 'UPDATE_ORDER_STATUS'
    | 'DELETE_ORDER'
    | 'UPLOAD_DEMO'
    | 'DELETE_DEMO'
    | 'UPLOAD_FINISHED'
    | 'ARCHIVE_TO_DRIVE'
    | 'UPDATE_PRODUCT'
    | 'DELETE_PRODUCT'
    | 'UPDATE_SETTINGS'
    | 'VIEW_CUSTOMER'
    | 'EXPORT_DATA';

type ResourceType = 'order' | 'product' | 'customer' | 'settings' | 'file';

interface AuditEntry {
    adminId: string;
    action: AuditAction;
    resourceType: ResourceType;
    resourceId?: string;
    details?: Record<string, unknown>;
    request?: Request;
}

/**
 * Log an admin action to the audit table
 */
export async function auditLog(
    adminId: string,
    action: AuditAction,
    resourceType: ResourceType,
    resourceId?: string,
    details?: Record<string, unknown>,
    request?: Request
): Promise<void> {
    try {
        const supabase = getAdminSupabase();

        await supabase.from('admin_audit_log').insert({
            admin_id: adminId,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            details: details || {},
            ip_address: request?.headers.get('x-forwarded-for') ||
                request?.headers.get('x-real-ip') || null,
            user_agent: request?.headers.get('user-agent') || null,
        });
    } catch (error) {
        // Audit logging should never break the main flow
        console.error('[AuditLog] Failed to record audit entry:', error);
    }
}

/**
 * Batch audit log — for bulk operations
 */
export async function auditLogBatch(entries: AuditEntry[]): Promise<void> {
    try {
        const supabase = getAdminSupabase();

        const rows = entries.map(e => ({
            admin_id: e.adminId,
            action: e.action,
            resource_type: e.resourceType,
            resource_id: e.resourceId,
            details: e.details || {},
            ip_address: e.request?.headers.get('x-forwarded-for') || null,
            user_agent: e.request?.headers.get('user-agent') || null,
        }));

        await supabase.from('admin_audit_log').insert(rows);
    } catch (error) {
        console.error('[AuditLog] Batch audit failed:', error);
    }
}
