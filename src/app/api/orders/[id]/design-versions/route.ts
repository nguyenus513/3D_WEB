/**
 * Design Versions API
 * GET /api/orders/[id]/design-versions - List all design versions for an order
 *
 * Returns all versions with their images, ordered by version number.
 * Admin sees all, user sees only their own orders.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: orderId } = await props.params;
        const supabase = getAdminSupabase();

        // Check if admin or resolve profile ID
        const userRole = (session.user as { role?: string })?.role;
        const isAdmin = userRole === 'admin';

        if (!isAdmin) {
            const profileId = await getProfileId(session.user, supabase);
            if (!profileId) {
                return NextResponse.json({ error: 'Profile not found' }, { status: 401 });
            }

            // Verify order ownership
            const { data: order } = await supabase
                .from('orders')
                .select('user_id')
                .eq('id', orderId)
                .maybeSingle();

            if (!order || order.user_id !== profileId) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
            }
        }

        // Fetch all versions with images
        const { data: versions, error } = await supabase
            .from('design_versions')
            .select(`
                id,
                version_number,
                status,
                admin_note,
                user_feedback,
                created_at,
                reviewed_at,
                design_images (
                    id,
                    image_url,
                    label,
                    sort_order,
                    created_at
                )
            `)
            .eq('order_id', orderId)
            .order('version_number', { ascending: true });

        if (error) {
            console.error('[DesignVersions] Query error:', error);
            return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
        }

        // Sort images within each version
        const sortedVersions = (versions || []).map((v: any) => ({
            ...v,
            design_images: (v.design_images || []).sort(
                (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
            ),
        }));

        return NextResponse.json({
            success: true,
            versions: sortedVersions,
            total_versions: sortedVersions.length,
            latest_version: sortedVersions[sortedVersions.length - 1] || null,
        });
    } catch (error) {
        console.error('[DesignVersions] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

