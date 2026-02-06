import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireCsrf } from '@/lib/security/csrf';
import { archiveOrderFilesToDrive } from '@/lib/storage/archive-order';

/**
 * POST /api/admin/orders/[id]/archive
 * 
 * Archives order files from R2 to Google Drive when order is marked as delivered.
 * - Downloads files from R2
 * - Uploads to Google Drive with same folder structure
 * - Deletes from R2 after successful transfer
 * 
 * SECURITY: Admin only
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verify admin auth
        const session = await auth();
        const userRole = (session?.user as { role?: string })?.role;
        if (!session?.user || userRole !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const csrf = await requireCsrf(request);
        if (!csrf.valid) {
            return csrf.error!;
        }

        const { id: orderId } = await params;

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
        }

        const archiveResult = await archiveOrderFilesToDrive(orderId);

        if (!archiveResult.success) {
            return NextResponse.json({
                error: archiveResult.errors.join('; ') || 'Archive failed',
                missingOnDrive: archiveResult.missingOnDrive?.length ? archiveResult.missingOnDrive : undefined,
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: archiveResult.alreadyArchived
                ? 'Already archived'
                : `Archived ${archiveResult.archived}/${archiveResult.total} files to Google Drive`,
            archived: archiveResult.archived,
            total: archiveResult.total,
            errors: archiveResult.errors.length > 0 ? archiveResult.errors : undefined,
            alreadyArchived: archiveResult.alreadyArchived || false,
            missingOnDrive: archiveResult.missingOnDrive?.length ? archiveResult.missingOnDrive : undefined,
        });
    } catch (error) {
        console.error('Archive error:', error);
        return NextResponse.json({
            error: 'Archive failed: ' + (error as Error).message
        }, { status: 500 });
    }
}
