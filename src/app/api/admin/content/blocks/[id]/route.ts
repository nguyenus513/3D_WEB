import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/admin-guard';

interface RouteParams {
    params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    const { authorized, response } = await requireAdmin(request);
    if (!authorized) return response;

    try {
        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('content_blocks')
            .select('*')
            .eq('id', params.id)
            .maybeSingle();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, block: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
    const { authorized, response } = await requireAdmin(request);
    if (!authorized) return response;

    try {
        const body = await request.json();
        const payload = {
            block_key: body.block_key,
            block_type: body.block_type,
            sort_order: body.sort_order ?? 0,
            data: body.data ?? {},
            is_active: body.is_active ?? true,
            updated_at: new Date().toISOString(),
        };

        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('content_blocks')
            .update(payload)
            .eq('id', params.id)
            .select('*')
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, block: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { authorized, response } = await requireAdmin(request);
    if (!authorized) return response;

    try {
        const supabase = getAdminSupabase();
        const { error } = await supabase
            .from('content_blocks')
            .delete()
            .eq('id', params.id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
