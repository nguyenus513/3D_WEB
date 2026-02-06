import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/admin-guard';

export async function GET(request: NextRequest) {
    const { authorized, response } = await requireAdmin(request);
    if (!authorized) return response;

    try {
        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('content_pages')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, pages: data || [] });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const { authorized, response } = await requireAdmin(request);
    if (!authorized) return response;

    try {
        const body = await request.json();
        const slug = String(body.slug || '').trim();
        if (!slug) {
            return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
        }

        const payload = {
            slug,
            title: body.title ?? null,
            meta: body.meta ?? {},
            is_active: body.is_active ?? true,
        };

        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('content_pages')
            .insert(payload)
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
