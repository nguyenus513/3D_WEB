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
            .from('content_pages')
            .select('*')
            .eq('id', params.id)
            .maybeSingle();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, page: data });
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
            slug: body.slug,
            title: body.title ?? null,
            meta: body.meta ?? {},
            is_active: body.is_active ?? true,
            updated_at: new Date().toISOString(),
        };

        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('content_pages')
            .update(payload)
            .eq('id', params.id)
            .select('*')
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, page: data });
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
            .from('content_pages')
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
