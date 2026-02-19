import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { PresignUploadSchema } from '@/validators/upload-presign.schema';
import { checkUploadRateLimit } from '@/lib/security/rate-limit';
import { resolveUploadKey } from '@/lib/storage/upload-key';
import { getPresignedUploadUrl, isR2Configured } from '@/lib/storage/r2';
import { getProfileId } from '@/lib/utils/getProfileId';
import { requireCsrf } from '@/lib/security/csrf';

const ALLOWED_CONTENT_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'model/stl',
    'application/sla',
    'model/obj',
    'application/octet-stream',
]);

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const csrf = await requireCsrf(request);
        if (!csrf.valid) {
            return csrf.error!;
        }

        if (!isR2Configured()) {
            return NextResponse.json({ error: 'R2 not configured' }, { status: 500 });
        }

        const body = await request.json();
        const parsed = PresignUploadSchema.parse(body);
        const { fileName, contentType, size, params } = parsed;

        const supabase = getAdminSupabase();
        const profileId = await getProfileId(session.user, supabase);
        if (!profileId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
        }

        const userRole = (session.user as { role?: string }).role;
        const isAdmin = userRole === 'admin';

        const rateLimit = await checkUploadRateLimit(profileId, isAdmin);
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        if (!ALLOWED_CONTENT_TYPES.has(contentType) && !contentType.startsWith('image/')) {
            return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
        }

        // Product uploads are admin-only
        if ((params.type === 'product' || params.type === 'product-size') && !isAdmin) {
            return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        }

        // Ensure customer code is not spoofed
        const { data: profile } = await supabase
            .from('users')
            .select('customer_code')
            .eq('id', profileId)
            .single();
        const customerCode = profile?.customer_code || params.customerCode || '';

        const safeParams = { ...params, customerCode };

        // If orderCode provided, ensure ownership (non-admin)
        if (safeParams.orderCode && !isAdmin) {
            const { data: order } = await supabase
                .from('orders')
                .select('id, user_id')
                .eq('order_code', safeParams.orderCode)
                .maybeSingle();
            if (!order || order.user_id !== profileId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const key = resolveUploadKey(safeParams, fileName);
        const { url, publicUrl } = await getPresignedUploadUrl(key, contentType);

        return NextResponse.json({
            success: true,
            data: {
                url,
                key,
                publicUrl,
                contentType,
                size,
            },
        });
    } catch (error) {
        console.error('[Upload Presign] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
