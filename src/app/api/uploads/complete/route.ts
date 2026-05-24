import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { CompleteUploadSchema } from '@/validators/upload-presign.schema';
import { trackFileUpload } from '@/lib/security/file-access';
import { getProfileId } from '@/lib/utils/getProfileId';
import { requireCsrf } from '@/lib/security/csrf';

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

        const body = await request.json();
        const parsed = CompleteUploadSchema.parse(body);
        const { key, fileName, contentType, orderId, orderCode, isPublic } = parsed;

        const supabase = getAdminSupabase();
        const profileId = await getProfileId(session.user, supabase);
        if (!profileId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
        }

        const userRole = (session.user as { role?: string }).role;
        const isAdmin = userRole === 'admin';

        let resolvedOrderId = orderId;
        let resolvedOrderCode = orderCode;

        if (orderCode && !orderId) {
            const { data: order } = await supabase
                .from('orders')
                .select('id, user_id')
                .eq('order_code', orderCode)
                .maybeSingle();
            if (order) {
                if (!isAdmin && order.user_id !== profileId) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                resolvedOrderId = order.id;
            }
        }

        if (orderId && !orderCode) {
            const { data: order } = await supabase
                .from('orders')
                .select('id, order_code, user_id')
                .eq('id', orderId)
                .maybeSingle();
            if (!order) {
                return NextResponse.json({ error: 'Order not found' }, { status: 404 });
            }
            if (!isAdmin && order.user_id !== profileId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            resolvedOrderCode = order.order_code;
        }

        const fileId = await trackFileUpload(key, profileId, resolvedOrderId, {
            isPublic: isPublic,
            fileName,
            fileType: contentType,
        });

        return NextResponse.json({
            success: true,
            data: {
                file: {
                    id: key,
                    key,
                    fileId,
                    name: fileName,
                    url: `/api/files/${key}`,
                    type: contentType,
                },
                orderId: resolvedOrderId,
                orderCode: resolvedOrderCode,
            },
        });
    } catch (error) {
        console.error('[Upload Complete] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
